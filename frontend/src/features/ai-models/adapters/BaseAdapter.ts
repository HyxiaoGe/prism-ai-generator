import type { GenerationConfig, GenerationResult, AIModel } from '../types';

// 适配器验证结果
export interface AdapterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// 适配器状态
export interface AdapterStatus {
  isAvailable: boolean;
  isConfigured: boolean;
  lastError?: string;
  latency?: number; // 毫秒
}

// 适配器元数据
export interface AdapterMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  supportedFeatures: string[];
  requiredConfig: string[];
}

/**
 * 基础AI模型适配器抽象类
 * 所有AI模型适配器都必须继承此类并实现其抽象方法
 */
export abstract class BaseModelAdapter {
  protected model: AIModel;
  protected config: Record<string, any> = {};

  constructor(model: AIModel) {
    this.model = model;
  }

  /**
   * 获取适配器元数据
   */
  abstract getMetadata(): AdapterMetadata;

  /**
   * 初始化适配器
   */
  abstract initialize(config?: Record<string, any>): Promise<void>;

  /**
   * 检查适配器状态
   */
  abstract getStatus(): Promise<AdapterStatus>;

  /**
   * 验证生成配置
   */
  abstract validateConfig(config: GenerationConfig): AdapterValidationResult;

  /**
   * 生成图像 - 核心方法
   */
  abstract generateImage(config: GenerationConfig): Promise<GenerationResult[]>;

  /**
   * 获取模型默认配置
   */
  abstract getDefaultConfig(): Partial<GenerationConfig>;

  /**
   * 估算生成成本
   */
  abstract estimateCost(config: GenerationConfig): number;

  /**
   * 取消正在进行的生成
   */
  abstract cancelGeneration(): Promise<void>;

  /**
   * 获取模型信息
   */
  getModel(): AIModel {
    return this.model;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Record<string, any>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * 检查是否支持特定功能
   */
  supportsFeature(feature: string): boolean {
    const metadata = this.getMetadata();
    return metadata.supportedFeatures.includes(feature);
  }

  /**
   * 预处理生成配置 - 可被子类重写
   */
  protected preprocessConfig(config: GenerationConfig): GenerationConfig {
    return { ...config };
  }

  /**
   * 后处理生成结果 - 可被子类重写
   */
  protected postprocessResults(results: GenerationResult[]): GenerationResult[] {
    return results;
  }

  /**
   * 错误处理 - 可被子类重写
   */
  protected handleError(error: any): never {
    throw error instanceof Error ? error : new Error(String(error));
  }
} 