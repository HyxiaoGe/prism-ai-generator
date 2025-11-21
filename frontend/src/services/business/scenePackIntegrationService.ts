/**
 * 场景包和模板集成服务
 * 打通场景包系统和数据库模板系统
 */

import { SCENE_PACKS, type ScenePack } from '@/constants/scenePacks';
import { SceneTemplateService } from '@/services/business';
import type { SceneTemplate } from '@/types/database';

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
   * 将硬编码的场景包与数据库模板关联
   */
  private scenePackTemplateMap: Record<string, string> = {
    'portrait-photography': 'portrait', // 场景包ID -> 模板分类
    'landscape-epic': 'landscape',
    'chinese-style-art': 'chinese-style',
    'cyberpunk-neon': 'cyberpunk',
    'product-commercial': 'product',
    'anime-character': 'anime',
    'oil-painting-classic': 'oil-painting',
    'modern-minimalist': 'minimalist',
  };

  /**
   * 从场景包ID获取推荐的数据库模板
   */
  async getTemplatesForScenePack(scenePackId: string): Promise<SceneTemplate[]> {
    const category = this.scenePackTemplateMap[scenePackId];
    if (!category) {
      return [];
    }

    try {
      // 从数据库加载该分类的热门模板
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
   * 获取场景包的统计信息（从数据库）
   */
  async getScenePackStats(scenePackId: string): Promise<{
    usageCount: number;
    avgRating: number;
    lastUsed?: Date;
  }> {
    // TODO: 实现场景包使用统计
    // 可以创建新表 scene_pack_stats 或复用 scene_templates
    return {
      usageCount: 0,
      avgRating: 0,
    };
  }

  /**
   * 记录场景包使用
   */
  async trackScenePackUsage(scenePackId: string, userId: string): Promise<void> {
    try {
      // TODO: 保存到数据库
      console.log('📊 场景包使用统计:', { scenePackId, userId });

      // 可以选择：
      // 1. 创建新表 scene_pack_usage
      // 2. 复用 user_events 表
      // 3. 扩展 scene_templates 表
    } catch (error) {
      console.error('记录场景包使用失败:', error);
    }
  }

  /**
   * 将场景包转换为模板格式（用于统一展示）
   */
  scenePackToTemplate(scenePack: ScenePack): Partial<SceneTemplate> {
    return {
      id: `pack_${scenePack.id}`, // 添加前缀避免与真实模板冲突
      name: scenePack.name,
      description: scenePack.description,
      category: scenePack.category,
      difficulty: scenePack.difficulty as any,
      base_prompt: scenePack.examples[0] || '',
      suggested_tags: {
        art_style: scenePack.tags.artStyle ? [scenePack.tags.artStyle] : undefined,
        theme_style: scenePack.tags.themeStyle ? [scenePack.tags.themeStyle] : undefined,
        mood: scenePack.tags.mood ? [scenePack.tags.mood] : undefined,
        technical: scenePack.tags.technical,
        composition: scenePack.tags.composition,
        enhancement: scenePack.tags.enhancement,
      },
      thumbnail_url: scenePack.preview,
      example_images: [], // 场景包暂无示例图
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

  /**
   * 获取首页推荐（混合场景包和数据库模板）
   */
  async getHomepageRecommendations(limit: number = 12): Promise<Array<ScenePack | SceneTemplate>> {
    try {
      // 1. 获取场景包（前8个，因为是硬编码的精选）
      const scenePacks = SCENE_PACKS.slice(0, 8);

      // 2. 获取数据库热门模板（补充到12个）
      const templates = await this.templateService.browseTemplates({
        sortBy: 'popular',
        limit: limit - scenePacks.length,
      });

      // 3. 混合展示（场景包优先，因为是精选的）
      return [...scenePacks, ...templates];
    } catch (error) {
      console.error('获取首页推荐失败:', error);
      // 降级：只返回场景包
      return SCENE_PACKS.slice(0, limit);
    }
  }

  /**
   * 判断是场景包还是模板
   */
  isScenePack(item: any): item is ScenePack {
    return 'icon' in item && 'recommendedModel' in item;
  }

  /**
   * 统一应用场景包或模板
   */
  async applyItem(item: ScenePack | SceneTemplate): Promise<{
    basePrompt: string;
    suggestedTags: any;
    config?: any;
  }> {
    if (this.isScenePack(item)) {
      // 场景包：直接使用配置
      return {
        basePrompt: item.examples[0] || '',
        suggestedTags: item.tags,
        config: {
          model: item.recommendedModel,
          aspectRatio: item.recommendedAspectRatio,
          numInferenceSteps: item.recommendedSteps,
          scenePackId: item.id,
        },
      };
    } else {
      // 模板：使用现有的模板服务
      return await this.templateService.applyTemplate(item.id);
    }
  }
}

// 导出单例
export const scenePackIntegration = ScenePackIntegrationService.getInstance();
