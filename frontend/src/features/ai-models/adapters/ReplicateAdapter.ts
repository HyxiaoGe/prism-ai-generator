import { BaseModelAdapter, type AdapterMetadata, type AdapterStatus, type AdapterValidationResult } from './BaseAdapter';
import type { GenerationConfig, GenerationResult, AIModel } from '../types';

/**
 * Replicate API适配器
 * 支持Flux, SDXL等模型通过Replicate平台生成图像
 */
export class ReplicateAdapter extends BaseModelAdapter {
  private abortController?: AbortController;
  private readonly API_BASE_URL = '/.netlify/functions';

  constructor(model: AIModel) {
    super(model);
  }

  getMetadata(): AdapterMetadata {
    return {
      id: 'replicate-adapter',
      name: 'Replicate API Adapter',
      version: '1.0.0',
      description: 'Replicate平台AI模型适配器，支持Flux, SDXL等多种模型',
      author: 'Prism AI Team',
      homepage: 'https://replicate.com',
      supportedFeatures: [
        'text-to-image',
        'aspect-ratio-control',
        'batch-generation',
        'negative-prompts',
        'format-selection',
        'step-control'
      ],
      requiredConfig: []
    };
  }

  async initialize(config?: Record<string, any>): Promise<void> {
    if (config) {
      this.updateConfig(config);
    }
    
    // 检查API连接性
    const status = await this.getStatus();
    if (!status.isAvailable) {
      throw new Error('Replicate API不可用');
    }
  }

  async getStatus(): Promise<AdapterStatus> {
    try {
      const startTime = Date.now();
      
      // 简化的健康检查 - 检查是否在浏览器环境中（基本可用性检查）
      const isClient = typeof window !== 'undefined';
      const latency = Date.now() - startTime;
      
      // 在客户端环境中，我们认为适配器是可用的
      // 真正的API可用性会在实际生成时检查
      return {
        isAvailable: isClient,
        isConfigured: true,
        latency
      };
    } catch (error) {
      return {
        isAvailable: false,
        isConfigured: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  validateConfig(config: GenerationConfig): AdapterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证必需字段
    if (!config.prompt || config.prompt.trim().length === 0) {
      errors.push('提示词不能为空');
    }

    // 验证提示词长度
    if (config.prompt && config.prompt.length > 1000) {
      errors.push('提示词长度不能超过1000字符');
    }

    // 验证输出数量
    if (config.numOutputs < 1 || config.numOutputs > 4) {
      errors.push('输出数量必须在1-4之间');
    }

    // 验证推理步数
    const maxSteps = this.model.capabilities.maxSteps;
    if (config.numInferenceSteps < 1 || config.numInferenceSteps > maxSteps) {
      errors.push(`推理步数必须在1-${maxSteps}之间`);
    }

    // 验证宽高比
    const supportedRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    if (!supportedRatios.includes(config.aspectRatio)) {
      errors.push(`不支持的宽高比: ${config.aspectRatio}`);
    }

    // 验证输出格式
    if (!this.model.capabilities.supportedFormats.includes(config.outputFormat)) {
      errors.push(`不支持的输出格式: ${config.outputFormat}`);
    }

    // 性能建议
    if (config.numInferenceSteps > 20 && this.model.id === 'flux-schnell') {
      warnings?.push('Flux Schnell模型建议使用4步以获得最佳速度');
    }

    if (config.numOutputs > 2 && config.numInferenceSteps > 25) {
      warnings?.push('大量输出+高步数可能导致生成时间较长');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async generateImage(config: GenerationConfig): Promise<GenerationResult[]> {
    // 验证配置
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`配置错误: ${validation.errors.join(', ')}`);
    }

    // 预处理配置
    const processedConfig = this.preprocessConfig(config);

    // 创建取消控制器
    this.abortController = new AbortController();

    try {
      console.log('🚀 发送Replicate生成请求...');
      
      const response = await fetch(`${this.API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedConfig),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`生成失败 (${response.status}): ${errorData}`);
      }

      const result = await response.json();
      console.log('📡 API响应原始数据:', result);
      
      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }

      // 转换API响应为GenerationResult格式
      // result.data = { status: 'succeeded', output: [...], input: {...} }
      console.log('📊 result.data结构:', result.data);
      console.log('📊 result.data.output:', result.data.output);
      
      // 处理不同格式的输出数据
      let imageUrls: string[] = [];
      const rawOutput = result.data.output;
      
      if (Array.isArray(rawOutput)) {
        // 多图输出格式（如 Flux 模型）
        imageUrls = rawOutput;
      } else if (typeof rawOutput === 'string' && rawOutput.trim()) {
        // 单图输出格式（如 Google Imagen 模型）
        imageUrls = [rawOutput];
      } else {
        console.error('❌ 无效的输出格式:', rawOutput);
        throw new Error('API返回的图像数据格式错误或为空');
      }
      
      if (imageUrls.length === 0) {
        console.error('❌ 没有生成任何图像');
        throw new Error('没有生成任何图像');
      }
      
      console.log('🔗 提取到的图片URLs:', imageUrls);

      const results: GenerationResult[] = imageUrls.map((imageUrl: string, index: number) => ({
        id: `${Date.now()}-${index}`,
        imageUrl,
        prompt: config.prompt,
        config,
        createdAt: new Date(),
        status: 'completed' as const,
      }));

      console.log('✅ Replicate图像生成成功:', results);
      
      // 后处理结果
      return this.postprocessResults(results);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('生成已取消');
      }
      console.error('❌ ReplicateAdapter生成失败:', error);
      this.handleError(error);
    } finally {
      this.abortController = undefined;
    }
  }

  getDefaultConfig(): Partial<GenerationConfig> {
    return {
      ...this.model.defaultConfig,
      model: this.model.id
    };
  }

  estimateCost(config: GenerationConfig): number {
    const baseCost = this.model.costPerGeneration || 0;
    
    // 根据输出数量计算
    const totalCost = baseCost * config.numOutputs;
    
    // 根据步数调整成本（更多步数=更高成本）
    const stepMultiplier = config.numInferenceSteps / (this.model.defaultConfig.numInferenceSteps || 4);
    
    return totalCost * stepMultiplier;
  }

  async cancelGeneration(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      console.log('🛑 Replicate生成已取消');
    }
  }

  /**
   * 预处理配置 - Replicate特定的配置转换
   */
  protected preprocessConfig(config: GenerationConfig): GenerationConfig {
    const processed = { ...config };

    // 确保模型ID正确设置
    processed.model = this.model.id;

    // 根据模型特性调整配置
    switch (this.model.id) {
      case 'flux-schnell':
        // Flux Schnell优化配置
        processed.numInferenceSteps = Math.min(processed.numInferenceSteps, 4);
        break;
        
      case 'flux-dev':
        // Flux Dev优化配置
        if (processed.numInferenceSteps < 20) {
          console.warn('Flux Dev建议使用20+步数以获得最佳质量');
        }
        break;
        
      case 'sdxl-lightning':
        // SDXL Lightning优化配置
        processed.numInferenceSteps = Math.min(processed.numInferenceSteps, 8);
        break;
    }

    return processed;
  }

  /**
   * 后处理结果 - 添加Replicate特定的元数据
   */
  protected postprocessResults(results: GenerationResult[]): GenerationResult[] {
    return results.map(result => ({
      ...result,
      // 添加适配器信息到结果中
      metadata: {
        adapter: 'replicate',
        model: this.model.id,
        provider: this.model.provider,
        generatedAt: new Date().toISOString()
      }
    }));
  }
} 