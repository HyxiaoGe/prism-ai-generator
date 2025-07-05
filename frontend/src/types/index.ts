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
  // 新增：解析出的特征信息，用于智能标签回填
  parsedFeatures?: any;
  // 新增：用户选择的标签信息
  selectedTags?: {
    artStyle?: string;
    themeStyle?: string;
    mood?: string;
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
    negative?: string[];
    isQualityEnhanced?: boolean;
  };
}

// 生成结果
export interface GenerationResult {
  id: string;
  imageUrl: string;
  prompt: string;
  config: GenerationConfig;
  createdAt: Date;
  status: 'completed' | 'failed';
  // 新增：反馈相关字段
  userFeedback?: {
    type: 'like' | 'dislike' | null;
    submittedAt?: Date;
  };
  // 新增：真实的数据库generation_id（UUID格式）
  realGenerationId?: string;
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
  maxOutputs?: number; // 新增：最大输出数量限制
  supportedFormats: ('webp' | 'jpg' | 'png')[];
}

// AI模型信息
export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: 'replicate' | 'huggingface' | 'openai';
  isEnabled: boolean;
  runsNumber: string;
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

// 用户设置
export interface UserPreferences {
  defaultModel: string;
  defaultAspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  saveHistory: boolean;
  theme: 'light' | 'dark' | 'auto';
} 