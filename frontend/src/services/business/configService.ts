/**
 * 配置服务
 * 处理标签、场景模板、AI模型等配置数据的业务逻辑
 * 提供缓存和 fallback 机制
 */

import { ConfigRepository } from '../../repositories';
import type { TagRecord, SceneTemplate, AIModelConfig, TagCategory } from '../../types/database';
import {
  ART_STYLE_TAGS,
  THEME_STYLE_TAGS,
  MOOD_TAGS,
  TECHNICAL_TAGS,
  COMPOSITION_TAGS,
  ENHANCEMENT_TAGS,
  SCENE_TEMPLATES as LOCAL_SCENE_TEMPLATES,
  SUBJECT_SUGGESTIONS,
  Tag as LocalTag,
} from '../../constants/tags';

export class ConfigService {
  private static instance: ConfigService;
  private configRepository: ConfigRepository;

  // 缓存
  private tagsCache: TagRecord[] | null = null;
  private tagsCacheExpiry: number = 0;
  private sceneTemplatesCache: SceneTemplate[] | null = null;
  private sceneTemplatesCacheExpiry: number = 0;
  private aiModelsCache: AIModelConfig[] | null = null;
  private aiModelsCacheExpiry: number = 0;

  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

  private constructor() {
    this.configRepository = ConfigRepository.getInstance();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // ============================================
  // 标签相关方法
  // ============================================

  /**
   * 获取所有标签（带缓存和 fallback）
   */
  async getTags(): Promise<TagRecord[]> {
    const now = Date.now();

    // 检查缓存
    if (this.tagsCache && now < this.tagsCacheExpiry) {
      return this.tagsCache;
    }

    try {
      const tags = await this.configRepository.getTags();

      if (tags.length > 0) {
        this.tagsCache = tags;
        this.tagsCacheExpiry = now + this.CACHE_DURATION;
        console.log(`📦 从数据库加载了 ${tags.length} 个标签`);
        return tags;
      }
    } catch (error) {
      console.warn('⚠️ 从数据库获取标签失败，使用本地数据:', error);
    }

    // Fallback 到本地数据
    return this.getLocalTagsAsRecords();
  }

  /**
   * 按分类获取标签
   */
  async getTagsByCategory(category: TagCategory): Promise<TagRecord[]> {
    const allTags = await this.getTags();
    return allTags.filter(tag => tag.category === category);
  }

  /**
   * 将本地标签转换为数据库记录格式（用于 fallback）
   */
  private getLocalTagsAsRecords(): TagRecord[] {
    const convertTags = (tags: LocalTag[], category: TagCategory): TagRecord[] => {
      return tags.map((tag, index) => ({
        id: `local-${category}-${index}`,
        category,
        label: tag.label,
        value: tag.value,
        display_value: tag.displayValue,
        sort_order: index + 1,
        is_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    };

    const subjectSuggestionTags: TagRecord[] = SUBJECT_SUGGESTIONS.map((suggestion, index) => ({
      id: `local-subject_suggestion-${index}`,
      category: 'subject_suggestion' as TagCategory,
      label: suggestion,
      value: suggestion,
      display_value: suggestion,
      sort_order: index + 1,
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return [
      ...convertTags(ART_STYLE_TAGS, 'art_style'),
      ...convertTags(THEME_STYLE_TAGS, 'theme_style'),
      ...convertTags(MOOD_TAGS, 'mood'),
      ...convertTags(TECHNICAL_TAGS, 'technical'),
      ...convertTags(COMPOSITION_TAGS, 'composition'),
      ...convertTags(ENHANCEMENT_TAGS, 'enhancement'),
      ...subjectSuggestionTags,
    ];
  }

  // ============================================
  // 场景模板相关方法
  // ============================================

  /**
   * 获取所有场景模板（带缓存和 fallback）
   */
  async getSceneTemplates(): Promise<SceneTemplate[]> {
    const now = Date.now();

    // 检查缓存
    if (this.sceneTemplatesCache && now < this.sceneTemplatesCacheExpiry) {
      return this.sceneTemplatesCache;
    }

    try {
      const templates = await this.configRepository.getSceneTemplates();

      if (templates.length > 0) {
        this.sceneTemplatesCache = templates;
        this.sceneTemplatesCacheExpiry = now + this.CACHE_DURATION;
        console.log(`📦 从数据库加载了 ${templates.length} 个场景模板`);
        return templates;
      }
    } catch (error) {
      console.warn('⚠️ 从数据库获取场景模板失败，使用本地数据:', error);
    }

    // Fallback 到本地数据
    return this.getLocalSceneTemplatesAsRecords();
  }

  /**
   * 将本地场景模板转换为数据库记录格式
   */
  private getLocalSceneTemplatesAsRecords(): SceneTemplate[] {
    // 将旧格式转换为新格式
    return LOCAL_SCENE_TEMPLATES.map((template, index) => ({
      id: `local-template-${index}`,
      name: template.label,
      description: template.prompt,
      category: 'general',
      subcategory: undefined,
      tags: [],
      difficulty: 'beginner' as const,
      base_prompt: template.prompt,
      suggested_tags: {
        technical: template.technical ? [template.technical] : [],
        mood: template.mood ? [template.mood] : [],
      },
      thumbnail_url: undefined,
      example_images: [],
      usage_count: 0,
      rating: 0,
      likes_count: 0,
      author_id: undefined,
      is_official: true,
      is_public: true,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  // ============================================
  // AI 模型相关方法
  // ============================================

  /**
   * 获取所有启用的 AI 模型（带缓存和 fallback）
   */
  async getAIModels(): Promise<AIModelConfig[]> {
    const now = Date.now();

    // 检查缓存
    if (this.aiModelsCache && now < this.aiModelsCacheExpiry) {
      return this.aiModelsCache;
    }

    try {
      const models = await this.configRepository.getAIModels();

      if (models.length > 0) {
        this.aiModelsCache = models;
        this.aiModelsCacheExpiry = now + this.CACHE_DURATION;
        console.log(`📦 从数据库加载了 ${models.length} 个 AI 模型`);
        return models;
      }
    } catch (error) {
      console.warn('⚠️ 从数据库获取 AI 模型失败，使用本地数据:', error);
    }

    // Fallback 到本地数据
    return this.getLocalAIModelsAsRecords();
  }

  /**
   * 根据 ID 获取 AI 模型
   */
  async getAIModelById(id: string): Promise<AIModelConfig | null> {
    const models = await this.getAIModels();
    return models.find(m => m.id === id) || null;
  }

  /**
   * 将本地 AI 模型配置转换为数据库记录格式
   */
  private getLocalAIModelsAsRecords(): AIModelConfig[] {
    return [
      {
        id: 'flux-schnell',
        name: 'black-forest-labs',
        description: '超快速生成，4步出图，适合快速迭代和预览',
        provider: 'replicate',
        cost_per_generation: 0.003,
        runs_number: '392.8M',
        tags: ['超快', '经济', '推荐'],
        default_config: {
          numInferenceSteps: 4,
          aspectRatio: '1:1',
          outputFormat: 'webp',
          numOutputs: 4,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 4,
          maxOutputs: 4,
          supportedFormats: ['webp', 'jpg', 'png'],
        },
        is_enabled: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'imagen-4-ultra',
        name: 'Google',
        description: '高质量生成，细节丰富，适合最终作品和专业用途',
        provider: 'replicate',
        cost_per_generation: 0.004,
        runs_number: '677.9K',
        tags: ['高质量', '专业'],
        default_config: {
          numInferenceSteps: 28,
          aspectRatio: '16:9',
          outputFormat: 'jpg',
          numOutputs: 1,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 50,
          maxOutputs: 1,
          supportedFormats: ['jpg', 'png'],
        },
        is_enabled: true,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  // ============================================
  // 缓存管理
  // ============================================

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.tagsCache = null;
    this.tagsCacheExpiry = 0;
    this.sceneTemplatesCache = null;
    this.sceneTemplatesCacheExpiry = 0;
    this.aiModelsCache = null;
    this.aiModelsCacheExpiry = 0;
    console.log('🗑️ 配置缓存已清除');
  }

  /**
   * 清除标签缓存
   */
  clearTagsCache(): void {
    this.tagsCache = null;
    this.tagsCacheExpiry = 0;
  }

  /**
   * 清除场景模板缓存
   */
  clearSceneTemplatesCache(): void {
    this.sceneTemplatesCache = null;
    this.sceneTemplatesCacheExpiry = 0;
  }

  /**
   * 清除 AI 模型缓存
   */
  clearAIModelsCache(): void {
    this.aiModelsCache = null;
    this.aiModelsCacheExpiry = 0;
  }
}
