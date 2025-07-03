import type { GenerationConfig, GenerationResult, AIModel } from '../types';
import { AdapterManager } from './AdapterManager';

export class AIService {
  private static adapterManager = AdapterManager.getInstance();

  /**
   * 获取可用的AI模型列表
   */
  static async getAvailableModels(): Promise<AIModel[]> {
    // 返回硬编码的模型列表，实际项目中可以从API获取
    return [
      {
        id: 'flux-schnell',
        name: 'black-forest-labs',
        description: '超快速生成，4步出图，适合快速迭代和预览',
        provider: 'replicate',
        isEnabled: true,
        runsNumber: '392.8M',
        costPerGeneration: 0.003,
        tags: ['超快', '经济', '推荐'],
        defaultConfig: {
          numInferenceSteps: 4,
          aspectRatio: '1:1',
          outputFormat: 'webp',
          numOutputs: 4,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 4,
          maxOutputs: 4, // Flux Schnell支持最多4张图片
          supportedFormats: ['webp', 'jpg', 'png'],
        },
      },
      {
        id: 'imagen-4-ultra',
        name: 'Google',
        description: '高质量生成，细节丰富，适合最终作品和专业用途',
        provider: 'replicate',
        isEnabled: true,
        runsNumber: '677.9K',
        costPerGeneration: 0.055,
        tags: ['高质量', '专业'],
        defaultConfig: {
          numInferenceSteps: 28,
          aspectRatio: '1:1',
          outputFormat: 'jpg',
          numOutputs: 1,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 50,
          maxOutputs: 1, // Google Imagen模型只能生成1张图片
          supportedFormats: ['jpg', 'png'],
        },
      },
      {
        id: 'sdxl-lightning-4step',
        name: 'ByteDance',
        description: '闪电生成速度，平衡质量与效率，支持多种风格',
        provider: 'replicate',
        isEnabled: true,
        runsNumber: '1B',
        costPerGeneration: 0.004,
        tags: ['快速', '平衡'],
        defaultConfig: {
          numInferenceSteps: 4,
          aspectRatio: '1:1',
          outputFormat: 'webp',
          numOutputs: 4,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 8,
          maxOutputs: 4, // ByteDance支持最多4张图片
          supportedFormats: ['webp', 'jpg', 'png'],
        },
      },
      {
        id: 'stable-diffusion',
        name: 'Stable Diffusion',
        description: '经典模型，兼容性强，支持多种风格和细致调参',
        provider: 'replicate',
        isEnabled: true,
        runsNumber: '110.5M',
        costPerGeneration: 0.0095,
        tags: ['经典', '兼容'],
        defaultConfig: {
          numInferenceSteps: 25,
          aspectRatio: '1:1',
          outputFormat: 'webp',
          numOutputs: 4,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 50,
          maxOutputs: 4, // Stable Diffusion支持最多4张图片
          supportedFormats: ['webp', 'jpg', 'png'],
        },
      },
    ];
  }

  /**
   * 生成图像 - 使用插件化适配器系统
   */
  static async generateImage(config: GenerationConfig): Promise<GenerationResult[]> {
    try {
      // 获取指定模型
      const models = await this.getAvailableModels();
      const model = models.find(m => m.id === config.model);
      
      if (!model) {
        throw new Error(`模型 ${config.model} 不存在`);
      }

      // 创建适配器
      const adapter = await this.adapterManager.createAdapter(model);
      
      // 使用适配器生成图像
      console.log(`🎨 使用 ${adapter.getMetadata().name} 生成图像...`);
      const results = await adapter.generateImage(config);
      
      console.log('✅ 图像生成成功:', results);
      return results;

    } catch (error) {
      console.error('❌ 生成请求失败:', error);
      throw error;
    }
  }

  /**
   * 验证生成配置 - 使用适配器验证
   */
  static async validateConfig(config: GenerationConfig): Promise<{ isValid: boolean; errors: string[]; warnings?: string[] }> {
    try {
      // 获取指定模型
      const models = await this.getAvailableModels();
      const model = models.find(m => m.id === config.model);
      
      if (!model) {
        return {
          isValid: false,
          errors: [`模型 ${config.model} 不存在`]
        };
      }

      // 创建适配器并验证
      const adapter = await this.adapterManager.createAdapter(model);
      return adapter.validateConfig(config);

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : '验证失败']
      };
    }
  }

  /**
   * 估算生成成本 - 使用适配器计算
   */
  static async estimateCost(config: GenerationConfig): Promise<number> {
    try {
      // 获取指定模型
      const models = await this.getAvailableModels();
      const model = models.find(m => m.id === config.model);
      
      if (!model) {
        return 0;
      }

      // 创建适配器并计算成本
      const adapter = await this.adapterManager.createAdapter(model);
      return adapter.estimateCost(config);

    } catch (error) {
      console.warn('成本估算失败:', error);
      return 0;
    }
  }

  /**
   * 获取推荐配置 - 使用适配器获取
   */
  static async getRecommendedConfig(modelId: string): Promise<Partial<GenerationConfig>> {
    try {
      const models = await this.getAvailableModels();
      const model = models.find(m => m.id === modelId);
      
      if (!model) {
        throw new Error(`模型 ${modelId} 不存在`);
      }

      const adapter = await this.adapterManager.createAdapter(model);
      return adapter.getDefaultConfig();

    } catch (error) {
      console.warn('获取推荐配置失败:', error);
      return {};
    }
  }

  /**
   * 获取适配器管理器实例
   */
  static getAdapterManager(): AdapterManager {
    return this.adapterManager;
  }

  /**
   * 检查所有适配器状态
   */
  static async checkAdaptersHealth(): Promise<Map<string, any>> {
    return await this.adapterManager.checkAdaptersStatus();
  }

  /**
   * 取消所有正在进行的生成
   */
  static async cancelAllGenerations(): Promise<void> {
    await this.adapterManager.cleanup();
  }

  /**
   * 获取适配器统计信息
   */
  static getAdapterStatistics() {
    return this.adapterManager.getStatistics();
  }
} 