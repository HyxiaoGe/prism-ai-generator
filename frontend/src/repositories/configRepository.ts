/**
 * 配置仓库
 * 处理标签、场景模板、AI模型等配置数据的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { TagRecord, SceneTemplate, AIModelConfig, TagCategory } from '../types/database';

export class ConfigRepository extends BaseRepository {
  private static instance: ConfigRepository;

  private constructor() {
    super();
  }

  static getInstance(): ConfigRepository {
    if (!ConfigRepository.instance) {
      ConfigRepository.instance = new ConfigRepository();
    }
    return ConfigRepository.instance;
  }

  // ============================================
  // 标签相关方法
  // ============================================

  /**
   * 获取所有启用的标签
   */
  async getTags(): Promise<TagRecord[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取标签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 按分类获取标签
   */
  async getTagsByCategory(category: TagCategory): Promise<TagRecord[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .eq('category', category)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取分类标签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取所有标签（包括禁用的，用于管理后台）
   */
  async getAllTags(): Promise<TagRecord[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取所有标签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 创建标签
   */
  async createTag(tag: Omit<TagRecord, 'id' | 'created_at' | 'updated_at'>): Promise<TagRecord> {
    const { data, error } = await this.supabase
      .from('tags')
      .insert(tag)
      .select()
      .single();

    if (error) {
      throw new Error(`创建标签失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 更新标签
   */
  async updateTag(id: string, updates: Partial<TagRecord>): Promise<TagRecord> {
    const { data, error } = await this.supabase
      .from('tags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新标签失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 删除标签
   */
  async deleteTag(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`删除标签失败: ${error.message}`);
    }
  }

  // ============================================
  // 场景模板相关方法
  // ============================================

  /**
   * 获取所有启用的场景模板
   */
  async getSceneTemplates(): Promise<SceneTemplate[]> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取场景模板失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取所有场景模板（包括禁用的）
   */
  async getAllSceneTemplates(): Promise<SceneTemplate[]> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取所有场景模板失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 创建场景模板
   */
  async createSceneTemplate(template: Omit<SceneTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<SceneTemplate> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      throw new Error(`创建场景模板失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 更新场景模板
   */
  async updateSceneTemplate(id: string, updates: Partial<SceneTemplate>): Promise<SceneTemplate> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新场景模板失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 删除场景模板
   */
  async deleteSceneTemplate(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('scene_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`删除场景模板失败: ${error.message}`);
    }
  }

  // ============================================
  // AI模型相关方法
  // ============================================

  /**
   * 获取所有启用的AI模型
   */
  async getAIModels(): Promise<AIModelConfig[]> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取AI模型失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取单个AI模型
   */
  async getAIModelById(id: string): Promise<AIModelConfig | null> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`获取AI模型失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取所有AI模型（包括禁用的）
   */
  async getAllAIModels(): Promise<AIModelConfig[]> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`获取所有AI模型失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 创建或更新AI模型（upsert）
   */
  async upsertAIModel(model: AIModelConfig): Promise<AIModelConfig> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .upsert(model)
      .select()
      .single();

    if (error) {
      throw new Error(`保存AI模型失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 更新AI模型
   */
  async updateAIModel(id: string, updates: Partial<AIModelConfig>): Promise<AIModelConfig> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`更新AI模型失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 删除AI模型
   */
  async deleteAIModel(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_models')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`删除AI模型失败: ${error.message}`);
    }
  }
}
