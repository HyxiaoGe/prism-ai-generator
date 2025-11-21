/**
 * 场景包和模板集成服务（重构版）
 *
 * 主要改进：
 * 1. 集成 TagMappingService，正确展开标签值
 * 2. 完善场景包应用逻辑（包括所有推荐配置）
 * 3. 统一场景包和数据库模板的处理流程
 * 4. 添加详细的日志和错误处理
 */

import { SCENE_PACKS, type ScenePack } from '@/constants/scenePacks';
import { SceneTemplateService } from './sceneTemplateService';
import { tagMappingService, type TagExpansionResult } from './tagMappingService';
import { supabase } from '@/config/supabase';
import type { SceneTemplate } from '@/types/database';
import type { GenerationConfig } from '@/types';

/**
 * 场景包应用结果
 */
export interface ScenePackApplicationResult {
  basePrompt: string;           // 基础提示词
  fullPrompt: string;           // 完整提示词（包含展开的标签）
  suggestedTags: any;           // 推荐的标签配置（原始格式）
  expandedTags: TagExpansionResult; // 展开后的标签详情
  config: Partial<GenerationConfig>; // 完整的生成配置
  warnings: string[];           // 警告信息
  source: 'scene_pack' | 'database_template'; // 数据源
}

/**
 * 场景包统计信息
 */
export interface ScenePackStats {
  usageCount: number;
  avgRating: number;
  lastUsed?: Date;
  favoritesCount?: number;
}

export class ScenePackIntegrationService {
  private static instance: ScenePackIntegrationService;
  private templateService: SceneTemplateService;

  private constructor() {
    this.templateService = SceneTemplateService.getInstance();
  }

  public static getInstance(): ScenePackIntegrationService {
    if (!ScenePackIntegrationService.instance) {
      ScenePackIntegrationService.instance = new ScenePackIntegrationService();
    }
    return ScenePackIntegrationService.instance;
  }

  /**
   * 场景包到模板的映射关系
   * 将硬编码的场景包与数据库模板分类关联
   */
  private scenePackTemplateMap: Record<string, string> = {
    'portrait-photography': 'portrait',
    'landscape-epic': 'landscape',
    'chinese-style-art': 'art',
    'cyberpunk-neon': 'art',
    'product-commercial': 'product',
    'anime-character': 'anime',
    'oil-painting-classic': 'art',
    'modern-minimalist': 'design',
  };

  // ============================================
  // 核心应用逻辑
  // ============================================

  /**
   * 统一应用场景包或模板（重构版）
   *
   * 主要改进：
   * 1. 使用 TagMappingService 展开标签
   * 2. 返回完整的生成配置
   * 3. 提供详细的警告信息
   */
  async applyItem(item: ScenePack | SceneTemplate): Promise<ScenePackApplicationResult> {
    if (this.isScenePack(item)) {
      return this.applyScenePack(item);
    } else {
      return this.applyDatabaseTemplate(item);
    }
  }

  /**
   * 应用硬编码场景包
   */
  private applyScenePack(scenePack: ScenePack): ScenePackApplicationResult {
    console.log('📦 应用场景包:', scenePack.name, scenePack.id);

    // 1. 获取基础提示词（使用第一个示例）
    const basePrompt = scenePack.examples[0] || '';

    // 2. 使用 TagMappingService 展开标签
    const expandedTags = tagMappingService.expandScenePackTags(scenePack.tags);

    // 3. 构建完整提示词
    const fullPrompt = tagMappingService.buildFullPrompt(
      basePrompt,
      scenePack.tags
    );

    // 4. 构建完整的生成配置
    const config: Partial<GenerationConfig> = {
      prompt: fullPrompt,
      model: scenePack.recommendedModel,
      aspectRatio: scenePack.recommendedAspectRatio,
      numInferenceSteps: scenePack.recommendedSteps || this.getDefaultSteps(scenePack.recommendedModel),
      outputFormat: 'webp', // 默认格式
      numOutputs: 4,        // 默认数量

      // 添加元数据用于追踪
      scenePackId: scenePack.id,
      scenePackName: scenePack.name,
    };

    // 5. 输出日志
    console.log('✅ 场景包应用完成');
    console.log('  - 基础提示词:', basePrompt);
    console.log('  - 完整提示词:', fullPrompt);
    console.log('  - 推荐模型:', config.model);
    console.log('  - 推荐宽高比:', config.aspectRatio);
    console.log('  - 推荐步数:', config.numInferenceSteps);

    if (expandedTags.warnings.length > 0) {
      console.warn('⚠️  标签映射警告:', expandedTags.warnings);
    }

    return {
      basePrompt,
      fullPrompt,
      suggestedTags: scenePack.tags,
      expandedTags,
      config,
      warnings: expandedTags.warnings,
      source: 'scene_pack',
    };
  }

  /**
   * 应用数据库模板
   */
  private async applyDatabaseTemplate(template: SceneTemplate): Promise<ScenePackApplicationResult> {
    console.log('💾 应用数据库模板:', template.name, template.id);

    // 1. 使用模板服务应用模板（会记录使用历史）
    const templateResult = await this.templateService.applyTemplate(template.id);

    // 2. 展开数据库模板的标签（注意：数据库使用下划线命名）
    const expandedTags = template.suggested_tags
      ? tagMappingService.expandDatabaseTemplateTags(template.suggested_tags as any)
      : { fullPrompt: '', expandedTags: [], warnings: [] };

    // 3. 构建完整提示词
    const fullPrompt = [templateResult.basePrompt, expandedTags.fullPrompt]
      .filter(Boolean)
      .join(', ');

    // 4. 构建生成配置（从模板的推荐配置）
    const config: Partial<GenerationConfig> = {
      prompt: fullPrompt,
      model: (template as any).recommended_model || 'flux-schnell',
      aspectRatio: (template as any).recommended_aspect_ratio || '1:1',
      numInferenceSteps: (template as any).recommended_steps || 4,
      outputFormat: (template as any).recommended_output_format || 'webp',
      numOutputs: (template as any).recommended_num_outputs || 4,

      // 添加元数据
      templateId: template.id,
      templateName: template.name,
    };

    console.log('✅ 数据库模板应用完成');
    console.log('  - 基础提示词:', templateResult.basePrompt);
    console.log('  - 完整提示词:', fullPrompt);

    return {
      basePrompt: templateResult.basePrompt,
      fullPrompt,
      suggestedTags: template.suggested_tags || {},
      expandedTags,
      config,
      warnings: expandedTags.warnings,
      source: 'database_template',
    };
  }

  /**
   * 根据模型获取默认步数
   */
  private getDefaultSteps(modelId: string): number {
    const stepsMap: Record<string, number> = {
      'flux-schnell': 4,
      'sdxl-lightning': 4,
      'flux-dev': 28,
      'stable-diffusion-xl': 20,
    };
    return stepsMap[modelId] || 4;
  }

  // ============================================
  // 辅助功能
  // ============================================

  /**
   * 判断是场景包还是模板
   */
  isScenePack(item: any): item is ScenePack {
    return 'icon' in item && 'recommendedModel' in item && 'nameEn' in item;
  }

  /**
   * 场景包转换为模板格式（用于统一展示）
   */
  scenePackToTemplate(scenePack: ScenePack): Partial<SceneTemplate> {
    return {
      id: `pack_${scenePack.id}`,
      name: scenePack.name,
      // @ts-ignore - 添加自定义字段
      name_en: scenePack.nameEn,
      // @ts-ignore
      icon: scenePack.icon,
      description: scenePack.description,
      category: scenePack.category,
      difficulty: scenePack.difficulty as any,
      base_prompt: scenePack.examples[0] || '',

      // 转换标签格式：单选转数组
      suggested_tags: {
        art_style: scenePack.tags.artStyle ? [scenePack.tags.artStyle] : undefined,
        theme_style: scenePack.tags.themeStyle ? [scenePack.tags.themeStyle] : undefined,
        mood: scenePack.tags.mood ? [scenePack.tags.mood] : undefined,
        technical: scenePack.tags.technical,
        composition: scenePack.tags.composition,
        enhancement: scenePack.tags.enhancement,
      },

      thumbnail_url: scenePack.preview,
      example_images: [],
      // @ts-ignore - 添加自定义字段
      examples: scenePack.examples,
      // @ts-ignore
      tips: scenePack.tips,

      // 推荐配置
      // @ts-ignore
      recommended_model: scenePack.recommendedModel,
      // @ts-ignore
      recommended_aspect_ratio: scenePack.recommendedAspectRatio,
      // @ts-ignore
      recommended_steps: scenePack.recommendedSteps,

      usage_count: scenePack.usageCount || 0,
      rating: 0,
      likes_count: 0,
      is_official: true,
      is_public: true,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ============================================
  // 查询和推荐
  // ============================================

  /**
   * 从场景包ID获取推荐的数据库模板
   */
  async getTemplatesForScenePack(scenePackId: string): Promise<SceneTemplate[]> {
    const category = this.scenePackTemplateMap[scenePackId];
    if (!category) {
      return [];
    }

    try {
      const templates = await this.templateService.browseTemplates({
        category,
        sortBy: 'popular',
        limit: 3,
      });

      return templates;
    } catch (error) {
      console.error('加载场景包关联模板失败:', error);
      return [];
    }
  }

  /**
   * 获取首页推荐（混合场景包和数据库模板）
   */
  async getHomepageRecommendations(limit: number = 12): Promise<Array<ScenePack | SceneTemplate>> {
    try {
      // 1. 获取所有场景包（硬编码的精选内容）
      const scenePacks = SCENE_PACKS.slice(0, 8);

      // 2. 获取数据库热门模板作为补充
      const remainingSlots = Math.max(0, limit - scenePacks.length);
      const templates = remainingSlots > 0
        ? await this.templateService.browseTemplates({
            sortBy: 'popular',
            limit: remainingSlots,
          })
        : [];

      // 3. 混合展示（场景包优先）
      return [...scenePacks, ...templates];
    } catch (error) {
      console.error('获取首页推荐失败:', error);
      // 降级：只返回场景包
      return SCENE_PACKS.slice(0, limit);
    }
  }

  /**
   * 获取所有场景包
   */
  getAllScenePacks(): ScenePack[] {
    return [...SCENE_PACKS];
  }

  /**
   * 根据ID获取场景包
   */
  getScenePackById(id: string): ScenePack | undefined {
    return SCENE_PACKS.find(pack => pack.id === id);
  }

  /**
   * 根据分类获取场景包
   */
  getScenePacksByCategory(category: ScenePack['category']): ScenePack[] {
    return SCENE_PACKS.filter(pack => pack.category === category);
  }

  /**
   * 搜索场景包（按名称或描述）
   */
  searchScenePacks(query: string): ScenePack[] {
    const lowerQuery = query.toLowerCase();
    return SCENE_PACKS.filter(
      pack =>
        pack.name.toLowerCase().includes(lowerQuery) ||
        pack.nameEn.toLowerCase().includes(lowerQuery) ||
        pack.description.toLowerCase().includes(lowerQuery)
    );
  }

  // ============================================
  // 统计功能（待实现）
  // ============================================

  /**
   * 获取场景包的统计信息（已实现数据库持久化）
   */
  async getScenePackStats(scenePackId: string): Promise<ScenePackStats> {
    try {
      // 查询统计视图
      const { data, error } = await supabase
        .from('v_scene_pack_stats' as any)
        .select('*')
        .eq('scene_pack_id', scenePackId)
        .single();

      if (error) {
        console.error('查询场景包统计失败:', error);
        return { usageCount: 0, avgRating: 0 };
      }

      if (!data) {
        return { usageCount: 0, avgRating: 0 };
      }

      return {
        usageCount: data.total_usage_count || 0,
        avgRating: data.avg_rating || 0,
        lastUsed: data.last_used_at ? new Date(data.last_used_at) : undefined,
        favoritesCount: 0, // TODO: 实现收藏功能
      };
    } catch (error) {
      console.error('获取场景包统计失败:', error);
      return { usageCount: 0, avgRating: 0 };
    }
  }

  /**
   * 记录场景包使用（已实现数据库持久化）
   */
  async trackScenePackUsage(
    scenePackId: string,
    userId: string,
    options?: {
      generationId?: string;
      wasSuccessful?: boolean;
      userRating?: number;
      appliedConfig?: Partial<GenerationConfig>;
    }
  ): Promise<void> {
    try {
      console.log('📊 记录场景包使用:', { scenePackId, userId });

      // 调用数据库函数记录使用
      const { data, error } = await supabase.rpc('record_scene_pack_usage', {
        p_scene_pack_id: scenePackId,
        p_template_id: null,
        p_user_id: userId,
        p_generation_id: options?.generationId || null,
        p_was_successful: options?.wasSuccessful ?? true,
        p_user_rating: options?.userRating || null,
        p_applied_config: options?.appliedConfig ? JSON.stringify(options.appliedConfig) : null,
      });

      if (error) {
        console.error('记录场景包使用失败:', error);
        return;
      }

      console.log('✅ 场景包使用已记录:', data);
    } catch (error) {
      console.error('记录场景包使用异常:', error);
    }
  }

  /**
   * 获取热门场景包
   */
  async getPopularScenePacks(limit: number = 10, days: number = 30): Promise<ScenePack[]> {
    try {
      // 调用数据库函数获取热门场景包
      const { data, error } = await supabase.rpc('get_popular_scene_packs', {
        p_limit: limit,
        p_days: days,
      });

      if (error) {
        console.error('获取热门场景包失败:', error);
        // 降级：返回硬编码的前N个
        return SCENE_PACKS.slice(0, limit);
      }

      if (!data || data.length === 0) {
        // 没有统计数据，返回默认场景包
        return SCENE_PACKS.slice(0, limit);
      }

      // 根据统计数据排序硬编码场景包
      const scenePacksWithStats = SCENE_PACKS.map(pack => {
        const stats = data.find((d: any) => d.scene_pack_id === pack.id);
        return {
          ...pack,
          usageCount: stats?.usage_count || 0,
          popularityScore: stats?.popularity_score || 0,
        };
      });

      // 按热度排序
      scenePacksWithStats.sort((a, b) => b.popularityScore - a.popularityScore);

      return scenePacksWithStats.slice(0, limit);
    } catch (error) {
      console.error('获取热门场景包异常:', error);
      return SCENE_PACKS.slice(0, limit);
    }
  }

  // ============================================
  // 搜索和筛选功能
  // ============================================

  /**
   * 搜索和筛选场景包
   */
  async searchScenePacks(options: {
    searchText?: string;
    category?: ScenePack['category'];
    difficulty?: ScenePack['difficulty'];
    tags?: string[];
    isOfficial?: boolean;
    sortBy?: 'popularity' | 'name' | 'created_at' | 'usage_count' | 'search_relevance';
    limit?: number;
    offset?: number;
  }): Promise<{ items: ScenePack[]; total: number }> {
    try {
      console.log('🔍 搜索场景包:', options);

      const {
        searchText,
        category,
        difficulty,
        tags,
        isOfficial,
        sortBy = 'popularity',
        limit = 20,
        offset = 0,
      } = options;

      // 调用数据库搜索函数
      const { data, error } = await supabase.rpc('search_scene_packs', {
        p_search_text: searchText || null,
        p_category: category || null,
        p_difficulty: difficulty || null,
        p_tags: tags || null,
        p_is_official: isOfficial ?? null,
        p_sort_by: sortBy,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('搜索场景包失败:', error);
        // 降级：使用硬编码场景包进行简单过滤
        return this.searchScenePacksLocally(options);
      }

      if (!data || data.length === 0) {
        return { items: [], total: 0 };
      }

      // 将数据库结果转换为 ScenePack 格式
      const items: ScenePack[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        nameEn: item.name_en,
        icon: item.icon,
        category: item.category,
        preview: item.thumbnail_url,
        description: item.description,
        difficulty: item.difficulty,
        tags: {}, // 简化处理，实际应该从 suggested_tags 解析
        recommendedModel: item.recommended_model,
        recommendedAspectRatio: item.recommended_aspect_ratio,
        recommendedSteps: item.recommended_steps,
        examples: item.examples || [],
        exampleImages: item.example_images || [],
        tips: item.tips,
        usageCount: item.usage_count || 0,
      }));

      return {
        items,
        total: items.length, // 如果需要总数，可以再执行一次 COUNT 查询
      };
    } catch (error) {
      console.error('搜索场景包异常:', error);
      return this.searchScenePacksLocally(options);
    }
  }

  /**
   * 本地搜索场景包（降级方案）
   */
  private searchScenePacksLocally(options: {
    searchText?: string;
    category?: ScenePack['category'];
    difficulty?: ScenePack['difficulty'];
    tags?: string[];
    isOfficial?: boolean;
    limit?: number;
    offset?: number;
  }): { items: ScenePack[]; total: number } {
    const {
      searchText,
      category,
      difficulty,
      limit = 20,
      offset = 0,
    } = options;

    let filtered = [...SCENE_PACKS];

    // 文本搜索
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(
        pack =>
          pack.name.toLowerCase().includes(lowerSearch) ||
          pack.nameEn.toLowerCase().includes(lowerSearch) ||
          pack.description.toLowerCase().includes(lowerSearch)
      );
    }

    // 分类筛选
    if (category) {
      filtered = filtered.filter(pack => pack.category === category);
    }

    // 难度筛选
    if (difficulty) {
      filtered = filtered.filter(pack => pack.difficulty === difficulty);
    }

    // 分页
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }

  /**
   * 获取场景包分类统计
   */
  async getCategoryStats(): Promise<
    Array<{ category: string; count: number; officialCount: number }>
  > {
    try {
      const { data, error } = await supabase.rpc('get_scene_pack_category_stats');

      if (error) {
        console.error('获取分类统计失败:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        category: item.category,
        count: item.count,
        officialCount: item.official_count,
      }));
    } catch (error) {
      console.error('获取分类统计异常:', error);
      return [];
    }
  }
}

// 导出单例
export const scenePackIntegration = ScenePackIntegrationService.getInstance();
