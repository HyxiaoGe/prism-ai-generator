import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AIService } from '../services/aiService';
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
          
          // 真实API模式
          updateProgress(5, 'processing');
          
          // 调用真实的AI服务
          const results = await AIService.generateImage(config);
          
          // 完成生成
          get().completeGeneration(results);
          
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

      completeGeneration: (results) =>
        set(
          (state) => ({
            currentGeneration: {
              ...initialGenerationStatus,
              stage: 'completed',
              progress: 100,
            },
            generationHistory: [...results, ...state.generationHistory],
          }),
          false,
          'completeGeneration'
        ),

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
    }),
    {
      name: 'ai-generation-store',
    }
  )
); 