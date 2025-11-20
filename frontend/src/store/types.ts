/**
 * aiGenerationStore 相关类型定义
 */

import type {
  GenerationConfig,
  GenerationResult,
  GenerationStatus,
  AIModel
} from '../types';
import type { UserUsageStats } from '../types/database';

// 生成批次接口
export interface GenerationBatch {
  id: string;
  prompt: string;
  config: GenerationConfig;
  results: GenerationResult[];
  createdAt: Date;
  model: string;
  // 真实的数据库generation_id（UUID格式）
  realGenerationId?: string;
  // 标签数据
  tags_used?: Array<{name: string, category: string, value: string}>;
}

// 分页状态
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

// Store 状态接口
export interface AIGenerationState {
  // 状态
  currentGeneration: GenerationStatus;
  generationHistory: GenerationResult[];
  generationBatches: GenerationBatch[];
  selectedModel: AIModel | null;
  availableModels: AIModel[];

  // 配置
  currentConfig: Partial<GenerationConfig>;

  // 用量追踪
  usageStats: UserUsageStats | null;

  // 加载状态
  isLoading: boolean;

  // 分页状态
  pagination: PaginationState;

  // Actions
  setSelectedModel: (model: AIModel) => void;
  updateConfig: (config: Partial<GenerationConfig>) => void;
  startGeneration: (config: GenerationConfig) => Promise<void>;
  updateProgress: (progress: number, stage?: GenerationStatus['stage']) => void;
  completeGeneration: (results: GenerationResult[]) => void;
  failGeneration: (error: string) => void;
  cancelGeneration: () => void;
  resetGeneration: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  removeBatch: (batchId: string) => void;
  setAvailableModels: (models: AIModel[]) => void;
  updateUsageStats: () => Promise<void>;
  loadHistoryFromDatabase: () => Promise<void>;
  loadHistoryWithPagination: (page?: number, replace?: boolean) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  resetPagination: () => void;
  setLoading: (loading: boolean) => void;
  prepareRegeneration: (result: GenerationResult) => Promise<void>;
  updateImageFeedback: (batchId: string, resultIndex: number, feedback: { type: 'like' | 'dislike' | null, submittedAt?: Date }) => void;
  loadFeedbackStates: () => Promise<void>;
}

// 初始状态
export const initialGenerationStatus: GenerationStatus = {
  isGenerating: false,
  progress: 0,
  stage: 'idle',
  error: null,
};

export const defaultConfig: Partial<GenerationConfig> = {
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

export const initialPagination: PaginationState = {
  currentPage: 1,
  totalPages: 1,
  total: 0,
  hasMore: false,
  isLoadingMore: false,
};
