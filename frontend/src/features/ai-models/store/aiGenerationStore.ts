import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AIService } from '../services/aiService';
import { UsageTracker } from '../../usage-tracking/services/usageTracker';
import type { 
  GenerationConfig, 
  GenerationResult, 
  GenerationStatus, 
  AIModel 
} from '../types';

interface AIGenerationState {
  // 状态
  currentGeneration: GenerationStatus;
  generationHistory: GenerationResult[];
  selectedModel: AIModel | null;
  availableModels: AIModel[];
  
  // 配置
  currentConfig: Partial<GenerationConfig>;
  
  // 用量追踪
  usageStats: {
    daily: { used: number; limit: number; remaining: number };
    hourly: { used: number; limit: number; remaining: number };
    session: { used: number; limit: number; remaining: number };
  } | null;
  
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
  setAvailableModels: (models: AIModel[]) => void;
  updateUsageStats: () => void;
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
      selectedModel: null,
      availableModels: [],
      currentConfig: defaultConfig,
      usageStats: null,

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

      startGeneration: async (config) => {
        const usageTracker = UsageTracker.getInstance();
        
        // 检查用量限制
        const usageCheck = usageTracker.canUse();
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
            usageTracker.recordUsage();
            
            // 更新使用统计
            const newStats = usageTracker.getUsageStats();
            set((state) => ({ ...state, usageStats: newStats }), false, 'updateUsageStats');
            
            // 短暂延迟让用户看到100%进度
            console.log('📊 准备完成生成，结果数量:', results.length);
            setTimeout(() => {
              console.log('📋 调用completeGeneration，结果:', results);
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
        console.log('🎯 completeGeneration被调用，参数:', results);
        console.log('📝 当前generationHistory长度:', get().generationHistory.length);
        
        set(
          (state) => {
            const newHistory = [...results, ...state.generationHistory];
            console.log('📈 新的generationHistory长度:', newHistory.length);
            
            return {
              currentGeneration: {
                ...initialGenerationStatus,
                stage: 'completed',
              },
              generationHistory: newHistory,
            };
          },
          false,
          'completeGeneration'
        );
        
        console.log('✅ completeGeneration完成，最终generationHistory长度:', get().generationHistory.length);
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

      setAvailableModels: (models) =>
        set({ availableModels: models }, false, 'setAvailableModels'),

      updateUsageStats: () => {
        const usageTracker = UsageTracker.getInstance();
        const stats = usageTracker.getUsageStats();
        set((state) => ({ ...state, usageStats: stats }), false, 'updateUsageStats');
      },
    }),
    {
      name: 'ai-generation-store',
      partialize: (state: AIGenerationState) => ({
        generationHistory: state.generationHistory,
        currentConfig: state.currentConfig,
      }),
    }
  )
); 