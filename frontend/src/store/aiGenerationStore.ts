import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AIService } from '../features/ai-models/services/aiService';
import { UsageTracker } from '../features/usage-tracking/services/usageTracker';
import { DatabaseService } from '../services/database';
import type { GenerationConfig, GenerationResult } from '../types';
import type { AIGenerationState, GenerationBatch } from './types';
import {
  initialGenerationStatus,
  defaultConfig,
  initialPagination,
} from './types';
import {
  uploadImagesToR2,
  extractTagsFromConfig,
  saveGenerationToDatabase,
  convertRecordsToBatches,
  generateBatchId,
} from './utils/generationUtils';

// 重新导出类型供外部使用
export type { GenerationBatch } from './types';

export const useAIGenerationStore = create<AIGenerationState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      currentGeneration: initialGenerationStatus,
      generationHistory: [],
      generationBatches: [], // 新增：批次数组
      selectedModel: null,
      availableModels: [],
      currentConfig: defaultConfig,
      usageStats: null,
      isLoading: false,
      // 分页状态
      pagination: initialPagination,

      // Actions
      setSelectedModel: (model) => 
        set({ selectedModel: model }, false, 'setSelectedModel'),

      updateConfig: (config) =>
        set(
          (state) => ({
            currentConfig: { ...state.currentConfig, ...config }
          }),
          false,
          'updateConfig'
        ),

      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'setLoading'),

      startGeneration: async (config) => {
        const usageTracker = UsageTracker.getInstance();
        
        // 检查用量限制
        const usageCheck = await usageTracker.canUse();
        if (!usageCheck.allowed) {
          get().failGeneration(usageCheck.reason || '使用次数已达上限');
          return;
        }        
        
        // 🔥 关键修复：保存完整的生成配置到store
        set(
          (state) => ({
            currentGeneration: {
              isGenerating: true,
              progress: 0,
              stage: 'processing',
              error: null,
              startTime: new Date(),
              estimatedTime: 30000, // Replicate通常20-30秒
            },
            currentConfig: { ...state.currentConfig, ...config } // 🎯 保存标签信息
          }),
          false,
          'startGeneration'
        );

        try {
          const { updateProgress } = get();
          
          // 智能进度模拟 - 模拟真实AI生成过程
          const simulateProgress = () => {
            let currentProgress = 0;
            const interval = setInterval(() => {
              if (!get().currentGeneration.isGenerating) {
                clearInterval(interval);
                return;
              }
              
              // 模拟不同阶段的进度速度
              if (currentProgress < 15) {
                // 理解提示词阶段 - 较快
                currentProgress += Math.random() * 3 + 1;
                updateProgress(Math.min(currentProgress, 15), 'processing');
              } else if (currentProgress < 50) {
                // 生成草图阶段 - 中等速度
                currentProgress += Math.random() * 2 + 0.5;
                updateProgress(Math.min(currentProgress, 50), 'processing');
              } else if (currentProgress < 85) {
                // 细化细节阶段 - 较慢
                currentProgress += Math.random() * 1.5 + 0.3;
                updateProgress(Math.min(currentProgress, 85), 'processing');
              } else if (currentProgress < 95) {
                // 最终优化阶段 - 缓慢
                currentProgress += Math.random() * 1 + 0.2;
                updateProgress(Math.min(currentProgress, 95), 'processing');
              }
            }, 500); // 每500ms更新一次进度
            
            return interval;
          };
          
          // 开始进度模拟
          const progressInterval = simulateProgress();
          
          try {
            // 调用真实的AI服务
            const results = await AIService.generateImage(config);
            
            // 清除进度模拟
            clearInterval(progressInterval);
            
            // 完成最后的进度更新
            updateProgress(100, 'processing');

            // 记录使用量
            await usageTracker.recordUsage();

            // 刷新用户信息（确保配额显示更新）
            try {
              const { useAuthStore } = await import('./authStore');
              await useAuthStore.getState().refreshUser();
            } catch (refreshError) {
              console.error('刷新用户信息失败:', refreshError);
            }

            // 更新使用统计
            const newStats = await usageTracker.getUsageStats();
            set((state) => ({ ...state, usageStats: newStats }), false, 'updateUsageStats');

            // 短暂延迟让用户看到100%进度
            setTimeout(() => {
              get().completeGeneration(results);
            }, 500);
            
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
          
        } catch (error) {
          console.error('❌ 生成失败:', error);
          get().failGeneration(error instanceof Error ? error.message : '生成失败');
        }
      },

      updateProgress: (progress, stage) =>
        set(
          (state) => ({
            currentGeneration: {
              ...state.currentGeneration,
              progress,
              stage: stage || state.currentGeneration.stage,
            }
          }),
          false,
          'updateProgress'
        ),

      completeGeneration: (results) => {
        const state = get();
        const batchId = generateBatchId();

        // 获取提示词 - 优先从results中获取，然后从currentConfig
        const prompt = results.length > 0 ? results[0].prompt : (state.currentConfig.prompt || '');

        // 创建新的生成批次
        const newBatch: GenerationBatch = {
          id: batchId,
          prompt: prompt,
          config: state.currentConfig as GenerationConfig,
          results: results,
          createdAt: new Date(),
          model: state.currentConfig.model || 'flux-schnell',
        };

        // 异步保存到数据库（不阻塞UI）
        const saveToDatabase = async () => {
          try {
            // 上传图片到R2存储
            const uploadedResults = await uploadImagesToR2(results, prompt, batchId);

            // 更新状态中的批次数据
            if (uploadedResults !== results) {
              set((state) => ({
                generationBatches: state.generationBatches.map(batch =>
                  batch.id === batchId
                    ? { ...batch, results: uploadedResults }
                    : batch
                ),
              }), false, 'updateBatchWithR2Urls');
            }

            // 提取标签数据
            const tagsUsed = extractTagsFromConfig(state.currentConfig);

            // 保存到数据库
            const savedGeneration = await saveGenerationToDatabase(
              prompt,
              state.currentConfig,
              uploadedResults,
              tagsUsed
            );

            if (savedGeneration && savedGeneration.id) {
              // 更新批次和结果的真实 generation_id
              set((state) => ({
                generationBatches: state.generationBatches.map(batch =>
                  batch.id === batchId ? {
                    ...batch,
                    realGenerationId: savedGeneration.id,
                    tags_used: tagsUsed,
                    results: batch.results.map(result => ({
                      ...result,
                      realGenerationId: savedGeneration.id,
                      tags_used: tagsUsed
                    }))
                  } : batch
                ),
                // 同步更新 generationHistory
                generationHistory: state.generationHistory.map(historyItem =>
                  results.some(result => result.id === historyItem.id) ? {
                    ...historyItem,
                    realGenerationId: savedGeneration.id,
                    tags_used: tagsUsed
                  } : historyItem
                )
              }), false, 'updateRealGenerationId');
            }
          } catch (dbError) {
            console.error('保存生成记录失败:', dbError);
          }
        };

        // 异步保存，不阻塞UI
        saveToDatabase();

        set(
          (state) => ({
            currentGeneration: {
              ...initialGenerationStatus,
              stage: 'completed',
              progress: 100,
            },
            // 保持向后兼容性
            generationHistory: [...results, ...state.generationHistory],
            // 新增：按批次存储
            generationBatches: [newBatch, ...state.generationBatches],
          }),
          false,
          'completeGeneration'
        );
      },

      failGeneration: (error) =>
        set(
          {
            currentGeneration: {
              ...initialGenerationStatus,
              stage: 'error',
              error,
            }
          },
          false,
          'failGeneration'
        ),

      cancelGeneration: () =>
        set(
          { currentGeneration: initialGenerationStatus },
          false,
          'cancelGeneration'
        ),

      resetGeneration: () =>
        set(
          { currentGeneration: initialGenerationStatus },
          false,
          'resetGeneration'
        ),

      clearHistory: () =>
        set({ generationHistory: [] }, false, 'clearHistory'),

      removeFromHistory: (id) =>
        set(
          (state) => ({
            generationHistory: state.generationHistory.filter(item => item.id !== id)
          }),
          false,
          'removeFromHistory'
        ),

      removeBatch: (batchId) =>
        set(
          (state) => ({
            generationBatches: state.generationBatches.filter(batch => batch.id !== batchId),
            // 同时更新generationHistory以保持兼容性
            generationHistory: state.generationHistory.filter(item => 
              !state.generationBatches.find(batch => 
                batch.id === batchId && batch.results.some(result => result.id === item.id)
              )
            ),
          }),
          false,
          'removeBatch'
        ),

      setAvailableModels: (models) =>
        set({ availableModels: models }, false, 'setAvailableModels'),

      updateUsageStats: async () => {
        const usageTracker = UsageTracker.getInstance();
        const stats = await usageTracker.getUsageStats();
        set({ usageStats: stats }, false, 'updateUsageStats');
      },

      loadHistoryFromDatabase: async () => {
        // 设置加载状态
        set({ isLoading: true }, false, 'setLoading');

        try {
          const databaseService = DatabaseService.getInstance();
          const records = await databaseService.getUserGenerations();

          if (records.length === 0) {
            set({ isLoading: false }, false, 'setLoading');
            return;
          }

          // 使用辅助函数转换记录为批次
          const { batches, historyResults } = convertRecordsToBatches(records);

          // 更新状态
          set(
            {
              generationHistory: historyResults,
              generationBatches: batches,
              isLoading: false,
            },
            false,
            'loadHistoryFromDatabase'
          );

          // 异步加载反馈状态
          get().loadFeedbackStates().catch(console.error);

        } catch (error) {
          console.error('❌ 从数据库加载历史记录失败:', error);
          // 即使出错也要清除加载状态
          set({ isLoading: false }, false, 'setLoading');
        }
      },

      prepareRegeneration: async (result: GenerationResult) => {
        try {
          // 从结果中提取配置
          const originalConfig = result.config;
          
          // 获取可用模型列表
          const { availableModels } = get();
          if (availableModels.length === 0) {
            // 如果还没有加载模型列表，先加载
            const models = await import('../features/ai-models/services/aiService').then(m => m.AIService.getAvailableModels());
            get().setAvailableModels(models);
          }
          
          // 查找对应的模型
          const targetModel = get().availableModels.find(m => m.id === originalConfig.model);
          
          // 智能解析提示词 - 提取基础描述和标签信息
          const { parsePromptFeatures } = await import('../features/ai-models/utils/promptParser');
          const parsedFeatures = parsePromptFeatures(result.prompt, originalConfig);
          
          // 更新当前配置和选中的模型
          set(
            (state) => ({
              currentConfig: {
                ...originalConfig,
                // 使用解析出的基础提示词，而不是完整的技术标签堆砌
                prompt: parsedFeatures.basePrompt || result.prompt,
                // 确保配置完整性，使用默认值补充缺失字段
                aspectRatio: originalConfig.aspectRatio || '1:1',
                numOutputs: originalConfig.numOutputs || 4,
                outputFormat: originalConfig.outputFormat || 'webp',
                numInferenceSteps: originalConfig.numInferenceSteps || 4,
                // 将解析出的标签信息保存，供PromptInput使用
                parsedFeatures: parsedFeatures,
              },
              selectedModel: targetModel || state.availableModels[0] || null,
            }),
            false,
            'prepareRegeneration'
          );
          
        } catch (error) {
          console.error('❌ 准备重新生成失败:', error);
          // 即使失败也不阻塞用户操作，使用当前提示词
          set(
            (state) => ({
              currentConfig: {
                ...state.currentConfig,
                prompt: result.prompt,
              }
            }),
            false,
            'prepareRegeneration'
          );
        }
      },

      updateImageFeedback: (batchId, resultIndex, feedback) => 
        set(
          (state) => ({
            generationBatches: state.generationBatches.map(batch => {
              if (batch.id === batchId) {
                return {
                  ...batch,
                  results: batch.results.map((result, index) => {
                    if (index === resultIndex) {
                      return {
                        ...result,
                        userFeedback: feedback.type ? {
                          type: feedback.type,
                          submittedAt: feedback.submittedAt || new Date()
                        } : undefined
                      };
                    }
                    return result;
                  })
                };
              }
              return batch;
            }),
            // 同步更新 generationHistory 以保持兼容性
            generationHistory: state.generationHistory.map(historyItem => {
              // 找到对应的批次和结果
              const batch = state.generationBatches.find(b => b.id === batchId);
              if (batch && batch.results[resultIndex]?.id === historyItem.id) {
                return {
                  ...historyItem,
                  userFeedback: feedback.type ? {
                    type: feedback.type,
                    submittedAt: feedback.submittedAt || new Date()
                  } : undefined
                };
              }
              return historyItem;
            })
          }),
          false,
          'updateImageFeedback'
        ),

      loadFeedbackStates: async () => {
        try {
          const databaseService = DatabaseService.getInstance();
          const { generationBatches } = get();

          // 🚀 性能优化：收集所有唯一的generation_id，避免重复查询
          const generationIds = new Set<string>();
          generationBatches.forEach(batch => {
            const generationId = batch.realGenerationId;
            if (generationId) {
              generationIds.add(generationId);
            }
          });

          if (generationIds.size === 0) {
            return;
          }

          // 🚀 使用新的批量查询API，一次请求获取所有反馈
          const feedbackMap = await databaseService.getBatchImageFeedback(Array.from(generationIds));
          
          // 更新批次数据
          const updatedBatches = generationBatches.map(batch => {
            const generationId = batch.realGenerationId;
            
            if (!generationId || !feedbackMap.has(generationId)) {
              return batch; // 没有反馈数据，保持原样
            }
            
            const feedbacks = feedbackMap.get(generationId)!;
            if (feedbacks.length === 0) {
              return batch; // 没有反馈，保持原样
            }
            
            // 使用最新的反馈（第一个，因为已按时间降序排列）
            const latestFeedback = feedbacks[0];
            
            // 为整个批次的所有图片应用相同的反馈状态
            const updatedResults = batch.results.map(result => ({
              ...result,
              userFeedback: {
                type: latestFeedback.feedback_type,
                submittedAt: new Date(latestFeedback.created_at)
              }
            }));
            
            return {
              ...batch,
              results: updatedResults
            };
          });
          
          // 更新状态
          set(
            (state) => ({
              generationBatches: updatedBatches,
              // 同步更新 generationHistory
              generationHistory: updatedBatches.flatMap(batch => batch.results)
            }),
            false,
            'loadFeedbackStates'
          );

        } catch (error) {
          console.error('❌ 加载反馈状态失败:', error);
        }
      },

      // 分页方法实现
      loadHistoryWithPagination: async (page = 1, replace = false) => {
        try {
          const databaseService = DatabaseService.getInstance();

          // 设置加载状态
          if (replace) {
            set({ isLoading: true }, false, 'loadHistoryWithPagination');
          } else {
            set((state) => ({
              pagination: { ...state.pagination, isLoadingMore: true }
            }), false, 'loadHistoryWithPagination');
          }

          // 获取分页数据
          const result = await databaseService.getUserGenerationsWithPagination({ page, limit: 10 });

          if (result.data.length === 0 && page === 1) {
            // 第一页没有数据
            set({
              generationHistory: [],
              generationBatches: [],
              isLoading: false,
              pagination: initialPagination
            }, false, 'loadHistoryWithPagination');
            return;
          }

          // 使用辅助函数转换记录为批次
          const { batches: newBatches, historyResults } = convertRecordsToBatches(result.data);

          // 更新状态
          set((state) => ({
            generationHistory: replace ? historyResults : [...state.generationHistory, ...historyResults],
            generationBatches: replace ? newBatches : [...state.generationBatches, ...newBatches],
            isLoading: false,
            pagination: {
              currentPage: result.currentPage,
              totalPages: result.totalPages,
              total: result.total,
              hasMore: result.hasMore,
              isLoadingMore: false,
            }
          }), false, 'loadHistoryWithPagination');

          // 异步加载反馈状态
          if (newBatches.length > 0) {
            get().loadFeedbackStates().catch(console.error);
          }

        } catch (error) {
          console.error('❌ 分页加载历史记录失败:', error);
          set((state) => ({
            isLoading: false,
            pagination: { ...state.pagination, isLoadingMore: false }
          }), false, 'loadHistoryWithPagination');
        }
      },

      loadMoreHistory: async () => {
        const { pagination } = get();
        if (!pagination.hasMore || pagination.isLoadingMore) {
          return;
        }
        
        await get().loadHistoryWithPagination(pagination.currentPage + 1, false);
      },

      resetPagination: () => {
        set({
          generationHistory: [],
          generationBatches: [],
          pagination: initialPagination
        }, false, 'resetPagination');
      },
    }),
    {
      name: 'ai-generation-store',
    }
  )
); 