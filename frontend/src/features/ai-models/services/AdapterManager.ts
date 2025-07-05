import { BaseModelAdapter, type AdapterMetadata, type AdapterStatus } from '../adapters/BaseAdapter';
import { ReplicateAdapter } from '../adapters/ReplicateAdapter';
import type { AIModel } from '../types';

// 适配器工厂函数类型
export type AdapterFactory = (model: AIModel) => BaseModelAdapter;

// 适配器注册信息
export interface AdapterRegistry {
  id: string;
  metadata: AdapterMetadata;
  factory: AdapterFactory;
  isBuiltIn: boolean;
}

/**
 * 适配器管理器
 * 负责管理所有AI模型适配器的注册、发现、创建和状态监控
 */
export class AdapterManager {
  private static instance: AdapterManager;
  private adapters = new Map<string, AdapterRegistry>();
  private activeAdapters = new Map<string, BaseModelAdapter>();

  private constructor() {
    this.registerBuiltInAdapters();
  }

  static getInstance(): AdapterManager {
    if (!AdapterManager.instance) {
      AdapterManager.instance = new AdapterManager();
    }
    return AdapterManager.instance;
  }

  /**
   * 注册内置适配器
   */
  private registerBuiltInAdapters(): void {
    // 注册Replicate适配器
    this.registerAdapter({
      id: 'replicate',
      metadata: {
        id: 'replicate-adapter',
        name: 'Replicate API Adapter',
        version: '1.0.0',
        description: 'Replicate平台AI模型适配器',
        author: 'Prism AI Team',
        supportedFeatures: [
          'text-to-image',
          'aspect-ratio-control',
          'batch-generation',
          'negative-prompts',
          'format-selection',
          'step-control'
        ],
        requiredConfig: []
      },
      factory: (model: AIModel) => new ReplicateAdapter(model),
      isBuiltIn: true
    });
  }

  /**
   * 注册新的适配器
   */
  registerAdapter(registry: AdapterRegistry): void {
    this.adapters.set(registry.id, registry);

  }

  /**
   * 取消注册适配器
   */
  unregisterAdapter(id: string): boolean {
    const registry = this.adapters.get(id);
    if (!registry) {
      return false;
    }

    // 不允许取消注册内置适配器
    if (registry.isBuiltIn) {
      console.warn(`⚠️ 无法取消注册内置适配器: ${id}`);
      return false;
    }

    // 清理活跃的适配器实例
    this.activeAdapters.delete(id);
    this.adapters.delete(id);
    

    return true;
  }

  /**
   * 获取所有已注册的适配器
   */
  getRegisteredAdapters(): AdapterRegistry[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 获取特定适配器的注册信息
   */
  getAdapterRegistry(id: string): AdapterRegistry | undefined {
    return this.adapters.get(id);
  }

  /**
   * 为模型创建适配器实例
   */
  async createAdapter(model: AIModel): Promise<BaseModelAdapter> {
    // 根据模型提供商选择适配器
    const adapterId = this.selectAdapterForModel(model);
    
    if (!adapterId) {
      throw new Error(`没有找到适合模型 ${model.id} 的适配器`);
    }

    const registry = this.adapters.get(adapterId);
    if (!registry) {
      throw new Error(`适配器 ${adapterId} 未注册`);
    }

    // 检查是否已有活跃实例
    const existingAdapter = this.activeAdapters.get(model.id);
    if (existingAdapter) {
      return existingAdapter;
    }

    // 创建新实例
    const adapter = registry.factory(model);
    
    try {
      await adapter.initialize();
      this.activeAdapters.set(model.id, adapter);
      
  
      return adapter;
    } catch (error) {
      console.error(`❌ 适配器创建失败: ${model.id}`, error);
      throw error;
    }
  }

  /**
   * 获取模型的活跃适配器
   */
  getActiveAdapter(modelId: string): BaseModelAdapter | undefined {
    return this.activeAdapters.get(modelId);
  }

  /**
   * 检查所有适配器的状态
   */
  async checkAdaptersStatus(): Promise<Map<string, AdapterStatus>> {
    const statusMap = new Map<string, AdapterStatus>();
    
    for (const [modelId, adapter] of this.activeAdapters) {
      try {
        const status = await adapter.getStatus();
        statusMap.set(modelId, status);
      } catch (error) {
        statusMap.set(modelId, {
          isAvailable: false,
          isConfigured: false,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return statusMap;
  }

  /**
   * 为模型选择最佳适配器
   */
  private selectAdapterForModel(model: AIModel): string | null {
    // 简单的选择逻辑 - 根据提供商匹配
    switch (model.provider) {
      case 'replicate':
        return 'replicate';
      case 'huggingface':
        // 可以在未来添加HuggingFace适配器
        return null;
      case 'openai':
        // 可以在未来添加OpenAI适配器
        return null;
      default:
        // 默认尝试Replicate适配器
        return 'replicate';
    }
  }

  /**
   * 清理所有适配器
   */
  async cleanup(): Promise<void> {

    
    for (const [modelId, adapter] of this.activeAdapters) {
      try {
        await adapter.cancelGeneration();
      } catch (error) {
        console.warn(`清理适配器 ${modelId} 时出错:`, error);
      }
    }
    
    this.activeAdapters.clear();
  }

  /**
   * 动态加载适配器插件 (未来功能)
   */
  async loadAdapterPlugin(pluginUrl: string): Promise<void> {
    try {
      // 这里可以实现动态加载外部适配器插件的逻辑
      // 例如从远程URL加载ES模块或WebAssembly模块
  
      
      // 示例：动态导入
      const module = await import(/* webpackIgnore: true */ pluginUrl);
      
      if (module.default && typeof module.default === 'function') {
        // 假设插件导出一个工厂函数
        const adapterFactory = module.default;
        
        // 验证插件接口
        const testAdapter = adapterFactory({} as AIModel);
        if (!(testAdapter instanceof BaseModelAdapter)) {
          throw new Error('插件必须返回BaseModelAdapter的实例');
        }
        
        const metadata = testAdapter.getMetadata();
        
        this.registerAdapter({
          id: metadata.id,
          metadata,
          factory: adapterFactory,
          isBuiltIn: false
        });
        

      } else {
        throw new Error('插件格式不正确');
      }
    } catch (error) {
      console.error(`❌ 加载适配器插件失败: ${pluginUrl}`, error);
      throw error;
    }
  }

  /**
   * 获取适配器统计信息
   */
  getStatistics() {
    return {
      totalAdapters: this.adapters.size,
      activeAdapters: this.activeAdapters.size,
      builtInAdapters: Array.from(this.adapters.values()).filter(a => a.isBuiltIn).length,
      pluginAdapters: Array.from(this.adapters.values()).filter(a => !a.isBuiltIn).length
    };
  }
} 