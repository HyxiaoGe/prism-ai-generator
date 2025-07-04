import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AIService } from '../features/ai-models/services/aiService';
import { UsageTracker } from '../features/usage-tracking/services/usageTracker';
import { DatabaseService } from '../services/database';
import type { 
  GenerationConfig, 
  GenerationResult, 
  GenerationStatus, 
  AIModel 
} from '../types';
import type { UserUsageStats } from '../types/database';

// 生成批次接口
interface GenerationBatch {
  id: string;
  prompt: string;
  config: GenerationConfig;
  results: GenerationResult[];
  createdAt: Date;
  model: string;
}

interface AIGenerationState {
  // 状态
  currentGeneration: GenerationStatus;
  generationHistory: GenerationResult[]; // 保持兼容性
  generationBatches: GenerationBatch[]; // 新增：按批次分组
  selectedModel: AIModel | null;
  availableModels: AIModel[];
  
  // 配置
  currentConfig: Partial<GenerationConfig>;
  
  // 用量追踪
  usageStats: UserUsageStats | null;
  
  // 加载状态
  isLoading: boolean;
  
  // Actions
  setSelectedModel: (model: AIModel) => void;
  updateConfig: (config: Partial<GenerationConfig>) => void;
  startGeneration: (config: GenerationConfig) => Promise<void>;
  updateProgress: (progress: number, stage?: GenerationStatus['stage']) => void;
  completeGeneration: (results: GenerationResult[]) => void;
  failGeneration: (error: string) => void;
  cancelGeneration: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  removeBatch: (batchId: string) => void; // 新增：删除批次
  setAvailableModels: (models: AIModel[]) => void;
  updateUsageStats: () => Promise<void>;
  loadHistoryFromDatabase: () => Promise<void>; // 新增：从数据库加载历史记录
  setLoading: (loading: boolean) => void;
}

const initialGenerationStatus: GenerationStatus = {
  isGenerating: false,
  progress: 0,
  stage: 'idle',
  error: null,
};

const defaultConfig: Partial<GenerationConfig> = {
  aspectRatio: '1:1',
  numOutputs: 4,
  outputFormat: 'webp',
  numInferenceSteps: 4,
  model: 'flux-schnell',
  // 兼容性字段
  width: 1024,
  height: 1024,
  steps: 4,
  guidance: 7.5,
};

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
        
        set(
          {
            currentGeneration: {
              isGenerating: true,
              progress: 0,
              stage: 'processing',
              error: null,
              startTime: new Date(),
              estimatedTime: 30000, // Replicate通常20-30秒
            }
          },
          false,
          'startGeneration'
        );

        try {
          console.log('🎨 开始生成图像，配置:', config);
          
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
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
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
            const databaseService = DatabaseService.getInstance();
            
            // 获取模型成本
            const models = await AIService.getAvailableModels();
            const model = models.find(m => m.id === state.currentConfig.model);
            const modelCost = model?.costPerGeneration || 0;
            
            await databaseService.saveGeneration({
              prompt: prompt,
              model_name: state.currentConfig.model || 'flux-schnell',
              model_cost: modelCost,
              image_urls: results.map(r => r.imageUrl),
              status: 'completed',
              is_public: true,
            });

            // 更新提示词统计
            await databaseService.updatePromptStats(prompt);
            
            console.log('✅ 生成记录已保存到数据库');
          } catch (dbError) {
            console.error('❌ 保存生成记录失败:', dbError);
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
            console.log('📝 数据库中没有历史记录');
            set({ isLoading: false }, false, 'setLoading');
            return;
          }

          console.log(`📚 从数据库加载了 ${records.length} 条生成记录`);
          
          // 按提示词和时间分组创建批次
          const batchesMap = new Map<string, GenerationBatch>();
          const historyResults: GenerationResult[] = [];
          
          // 按时间降序排列
          records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          for (const record of records) {
            // 处理时区转换：Supabase存储UTC时间，转换为本地时间
            const utcDate = new Date(record.created_at);
            const localDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
            
            // 处理图片URLs数组，为每张图片创建单独的结果
            const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [record.image_urls];
            
            // 为每张图片创建GenerationResult对象
            const batchResults: GenerationResult[] = [];
            imageUrls.forEach((imageUrl, index) => {
              const result: GenerationResult = {
                id: `${record.id}_${index}`, // 为每张图片创建唯一ID
                imageUrl: imageUrl,
                prompt: record.prompt,
                createdAt: localDate,
                status: record.status as 'completed' | 'failed',
                config: {
                  model: record.model_name,
                  prompt: record.prompt,
                  aspectRatio: '1:1',
                  numOutputs: imageUrls.length,
                  outputFormat: 'webp',
                  numInferenceSteps: 4,
                  width: 1024,
                  height: 1024,
                  steps: 4,
                  guidance: 7.5,
                }
              };
              
              batchResults.push(result);
              historyResults.push(result);
            });
            
            // 创建批次键：基于提示词和时间（精确到分钟）
            const timeKey = localDate.toISOString().substring(0, 16);
            const batchKey = `${record.prompt}_${timeKey}`;
            
            if (!batchesMap.has(batchKey)) {
              // 创建新批次
              const batch: GenerationBatch = {
                id: `batch_${record.id}_${Math.random().toString(36).substr(2, 9)}`,
                prompt: record.prompt,
                config: batchResults[0].config,
                results: batchResults, // 包含所有图片
                createdAt: localDate,
                model: record.model_name,
              };
              batchesMap.set(batchKey, batch);
            } else {
              // 添加到现有批次
              const existingBatch = batchesMap.get(batchKey)!;
              existingBatch.results.push(...batchResults);
            }
          }
          
          // 转换为数组并按时间降序排序
          const batches = Array.from(batchesMap.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
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
          
          console.log(`✅ 成功加载 ${batches.length} 个生成批次，共 ${historyResults.length} 张图片`);
          
        } catch (error) {
          console.error('❌ 从数据库加载历史记录失败:', error);
          // 即使出错也要清除加载状态
          set({ isLoading: false }, false, 'setLoading');
        }
      },
    }),
    {
      name: 'ai-generation-store',
    }
  )
); 