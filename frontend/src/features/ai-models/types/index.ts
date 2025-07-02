// 生成请求配置
export interface GenerationConfig {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  numOutputs: number;
  outputFormat: 'webp' | 'jpg' | 'png';
  numInferenceSteps: number;
  seed?: number;
  model: string;
  // 保留兼容性字段（用于UI显示，但不发送到API）
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
}

// 生成结果
export interface GenerationResult {
  id: string;
  imageUrl: string;
  prompt: string;
  config: GenerationConfig;
  createdAt: Date;
  status: 'completed' | 'failed';
}

// 生成状态
export interface GenerationStatus {
  isGenerating: boolean;
  progress: number;
  stage: 'idle' | 'processing' | 'generating' | 'completing' | 'completed' | 'error';
  error: string | null;
  startTime?: Date;
  estimatedTime?: number;
}

// 模型功能特性
export interface ModelCapabilities {
  supportsAspectRatio: boolean;
  maxSteps: number;
  supportedFormats: ('webp' | 'jpg' | 'png')[];
}

// AI模型信息
export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: 'replicate' | 'huggingface' | 'openai';
  isEnabled: boolean;
  costPerGeneration?: number;
  tags: string[]; // 新增：模型标签，如['快速', '经济', '推荐']
  defaultConfig: Partial<GenerationConfig>;
  capabilities: ModelCapabilities; // 新增：模型功能特性
}

// API响应类型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 