// AI模型功能模块的统一导出

// 核心服务和Store
export { useAIGenerationStore } from './store/aiGenerationStore';
export { AIService } from './services/aiService';

// 组件
export { PromptInput } from './components/PromptInput';
export { LoadingIndicator } from './components/LoadingIndicator';
export { ImageGrid } from './components/ImageGrid';

// 适配器系统
export { AdapterManager } from './services/AdapterManager';
export { BaseModelAdapter } from './adapters/BaseAdapter';
export { ReplicateAdapter } from './adapters/ReplicateAdapter';

// 类型导出
export type { 
  GenerationConfig, 
  GenerationResult, 
  GenerationStatus, 
  AIModel,
  ModelCapabilities 
} from './types';

// 适配器类型
export type {
  AdapterMetadata,
  AdapterStatus,
  AdapterValidationResult
} from './adapters/BaseAdapter';

export type {
  AdapterFactory,
  AdapterRegistry
} from './services/AdapterManager'; 