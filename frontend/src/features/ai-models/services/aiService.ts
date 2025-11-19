import type { GenerationConfig, GenerationResult, AIModel } from '../types';
import { AdapterManager } from './AdapterManager';
import { ConfigService } from '../../../services/business';
import type { AIModelConfig } from '../../../types/database';

export class AIService {
  private static adapterManager = AdapterManager.getInstance();
  private static configService = ConfigService.getInstance();

  /**
   * 将数据库模型配置转换为 AIModel 格式
   */
  private static convertToAIModel(config: AIModelConfig): AIModel {
    return {
      id: config.id,
      name: config.name,
      description: config.description || '',
      provider: config.provider as 'replicate' | 'huggingface' | 'openai',
      isEnabled: config.is_enabled,
      runsNumber: config.runs_number || '',
      costPerGeneration: config.cost_per_generation,
      tags: config.tags || [],
      defaultConfig: {
        numInferenceSteps: config.default_config?.numInferenceSteps,
        aspectRatio: config.default_config?.aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | undefined,
        outputFormat: config.default_config?.outputFormat as 'webp' | 'jpg' | 'png' | undefined,
        numOutputs: config.default_config?.numOutputs,
      },
      capabilities: {
        supportsAspectRatio: config.capabilities?.supportsAspectRatio ?? false,
        maxSteps: config.capabilities?.maxSteps ?? 50,
        maxOutputs: config.capabilities?.maxOutputs ?? 4,
        supportedFormats: (config.capabilities?.supportedFormats || ['webp', 'jpg', 'png']) as ('webp' | 'jpg' | 'png')[],
      },
    };
  }

  /**
   * 获取可用的AI模型列表
   */
  static async getAvailableModels(): Promise<AIModel[]> {
    try {
      const modelConfigs = await this.configService.getAIModels();
      return modelConfigs.map(config => this.convertToAIModel(config));
    } catch (error) {
      console.error('❌ 获取模型列表失败:', error);
      // 返回空数组而不是抛出错误，让 fallback 机制在 configService 中处理
      return [];
    }
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
      const results = await adapter.generateImage(config);
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

  /**
   * 清除模型缓存（当数据库模型配置更新时调用）
   */
  static clearModelsCache(): void {
    this.configService.clearAIModelsCache();
  }
}
