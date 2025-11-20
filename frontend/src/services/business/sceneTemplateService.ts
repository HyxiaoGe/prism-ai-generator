/**
 * 场景模板服务
 * 处理场景模板相关的业务逻辑
 */

import { SceneTemplateRepository, type TemplateFilter, type TemplateSortBy } from '../../repositories';
import { AuthService } from '../auth/authService';
import type { SceneTemplate, TemplateRating, TemplateUsageHistory } from '../../types/database';

// 模板浏览选项
export interface TemplateBrowseOptions {
  category?: string;
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  isOfficial?: boolean;
  searchQuery?: string;
  minRating?: number;
  sortBy?: TemplateSortBy;
  limit?: number;
}

// 模板推荐结果
export interface TemplateRecommendation {
  template: SceneTemplate;
  score: number;
  reason: string;
}

export class SceneTemplateService {
  private static instance: SceneTemplateService;
  private templateRepository: SceneTemplateRepository;
  private authService: AuthService;

  // 模板缓存
  private templatesCache: SceneTemplate[] | null = null;
  private templatesCacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {
    this.templateRepository = SceneTemplateRepository.getInstance();
    this.authService = AuthService.getInstance();
  }

  static getInstance(): SceneTemplateService {
    if (!SceneTemplateService.instance) {
      SceneTemplateService.instance = new SceneTemplateService();
    }
    return SceneTemplateService.instance;
  }

  // ============================================
  // 模板浏览和查询
  // ============================================

  /**
   * 获取所有活跃的模板（带缓存）
   */
  async getAllTemplates(sortBy: TemplateSortBy = 'popular'): Promise<SceneTemplate[]> {
    const now = Date.now();

    // 如果排序方式是popular且缓存有效，返回缓存
    if (sortBy === 'popular' && this.templatesCache && now < this.templatesCacheExpiry) {
      return this.templatesCache;
    }

    const templates = await this.templateRepository.findAll(sortBy);

    // 只缓存popular排序的结果
    if (sortBy === 'popular') {
      this.templatesCache = templates;
      this.templatesCacheExpiry = now + this.CACHE_DURATION;
    }

    return templates;
  }

  /**
   * 浏览模板（支持筛选和排序）
   */
  async browseTemplates(options: TemplateBrowseOptions = {}): Promise<SceneTemplate[]> {
    const filter: TemplateFilter = {
      category: options.category,
      subcategory: options.subcategory,
      difficulty: options.difficulty,
      tags: options.tags,
      isOfficial: options.isOfficial,
      searchQuery: options.searchQuery,
      minRating: options.minRating,
    };

    const sortBy = options.sortBy || 'popular';
    const limit = options.limit || 50;

    return this.templateRepository.findByFilter(filter, sortBy, limit);
  }

  /**
   * 搜索模板
   */
  async searchTemplates(query: string, limit: number = 20): Promise<SceneTemplate[]> {
    return this.browseTemplates({
      searchQuery: query,
      limit,
      sortBy: 'rating',
    });
  }

  /**
   * 获取模板详情
   */
  async getTemplateById(templateId: string): Promise<SceneTemplate | null> {
    return this.templateRepository.findById(templateId);
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<Array<{ category: string; subcategory: string | null; count: number }>> {
    return this.templateRepository.getCategories();
  }

  /**
   * 根据分类获取模板
   */
  async getTemplatesByCategory(
    category: string,
    subcategory?: string,
    sortBy: TemplateSortBy = 'popular'
  ): Promise<SceneTemplate[]> {
    return this.browseTemplates({
      category,
      subcategory,
      sortBy,
    });
  }

  // ============================================
  // 收藏功能
  // ============================================

  /**
   * 收藏模板
   */
  async favoriteTemplate(templateId: string, notes?: string): Promise<boolean> {
    const user = await this.authService.getAppUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    const result = await this.templateRepository.addFavorite(user.id, templateId, notes);
    return !!result;
  }

  /**
   * 取消收藏模板
   */
  async unfavoriteTemplate(templateId: string): Promise<boolean> {
    const user = await this.authService.getAppUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    return this.templateRepository.removeFavorite(user.id, templateId);
  }

  /**
   * 检查是否已收藏
   */
  async isTemplateFavorited(templateId: string): Promise<boolean> {
    const user = await this.authService.getAppUser();
    if (!user) {
      return false;
    }

    return this.templateRepository.isFavorited(user.id, templateId);
  }

  /**
   * 获取用户收藏列表
   */
  async getUserFavorites(): Promise<SceneTemplate[]> {
    const user = await this.authService.getAppUser();
    if (!user) {
      return [];
    }

    return this.templateRepository.getFavorites(user.id);
  }

  // ============================================
  // 评分功能
  // ============================================

  /**
   * 为模板评分
   */
  async rateTemplate(templateId: string, rating: number, review?: string): Promise<TemplateRating | null> {
    const user = await this.authService.getAppUser();
    if (!user) {
      throw new Error('用户未登录');
    }

    // 验证评分范围
    if (rating < 1 || rating > 5) {
      throw new Error('评分必须在1-5之间');
    }

    const result = await this.templateRepository.upsertRating(user.id, templateId, rating, review);

    // 清除缓存，因为评分会影响模板排序
    this.clearCache();

    return result;
  }

  /**
   * 获取用户对模板的评分
   */
  async getUserRating(templateId: string): Promise<TemplateRating | null> {
    const user = await this.authService.getAppUser();
    if (!user) {
      return null;
    }

    return this.templateRepository.getUserRating(user.id, templateId);
  }

  /**
   * 获取模板的所有评分
   */
  async getTemplateRatings(templateId: string, limit: number = 20): Promise<TemplateRating[]> {
    return this.templateRepository.getTemplateRatings(templateId, limit);
  }

  // ============================================
  // 使用功能
  // ============================================

  /**
   * 应用模板（记录使用并返回完整的提示词）
   */
  async applyTemplate(
    templateId: string,
    options?: {
      customModifications?: string;
      selectedTags?: Record<string, string[]>;
    }
  ): Promise<{
    basePrompt: string;
    fullPrompt: string;
    suggestedTags: any;
  }> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('模板不存在');
    }

    // 构建完整提示词
    let fullPrompt = template.base_prompt;

    // 如果有自定义修改，追加到提示词
    if (options?.customModifications) {
      fullPrompt = `${fullPrompt}, ${options.customModifications}`;
    }

    // 如果有选择的标签，追加到提示词
    if (options?.selectedTags) {
      const tagValues = Object.values(options.selectedTags).flat();
      if (tagValues.length > 0) {
        fullPrompt = `${fullPrompt}, ${tagValues.join(', ')}`;
      }
    }

    // 记录使用（不阻塞返回）
    const user = await this.authService.getAppUser();
    if (user) {
      this.templateRepository
        .recordUsage(user.id, templateId, {
          customModifications: options?.customModifications,
          wasSuccessful: true,
        })
        .catch(err => console.error('记录模板使用失败:', err));
    }

    return {
      basePrompt: template.base_prompt,
      fullPrompt,
      suggestedTags: template.suggested_tags || {},
    };
  }

  /**
   * 记录模板使用结果
   */
  async recordTemplateUsage(
    templateId: string,
    generationId: string,
    wasSuccessful: boolean,
    userRating?: number
  ): Promise<void> {
    const user = await this.authService.getAppUser();
    if (!user) {
      return;
    }

    await this.templateRepository.recordUsage(user.id, templateId, {
      generationId,
      wasSuccessful,
      userRating,
    });

    // 清除缓存
    this.clearCache();
  }

  /**
   * 获取用户使用历史
   */
  async getUserUsageHistory(limit: number = 50): Promise<TemplateUsageHistory[]> {
    const user = await this.authService.getAppUser();
    if (!user) {
      return [];
    }

    return this.templateRepository.getUserUsageHistory(user.id, limit);
  }

  // ============================================
  // 推荐功能
  // ============================================

  /**
   * 获取推荐模板（基于难度和热度）
   */
  async getRecommendedTemplates(limit: number = 6): Promise<TemplateRecommendation[]> {
    // 获取用户使用历史
    const usageHistory = await this.getUserUsageHistory(10);

    // 如果用户是新手（使用次数少），推荐初级模板
    if (usageHistory.length < 3) {
      const beginnerTemplates = await this.browseTemplates({
        difficulty: 'beginner',
        isOfficial: true,
        sortBy: 'popular',
        limit,
      });

      return beginnerTemplates.map(template => ({
        template,
        score: 1.0,
        reason: '适合新手的官方推荐模板',
      }));
    }

    // 对于有经验的用户，推荐高评分且使用较多的模板
    const popularTemplates = await this.browseTemplates({
      minRating: 4.0,
      sortBy: 'rating',
      limit: limit * 2,
    });

    // 过滤掉用户最近使用过的模板
    const recentTemplateIds = new Set(usageHistory.slice(0, 5).map(h => h.template_id));
    const filteredTemplates = popularTemplates.filter(t => !recentTemplateIds.has(t.id));

    return filteredTemplates.slice(0, limit).map(template => ({
      template,
      score: template.rating / 5.0,
      reason: `高评分模板 (${template.rating.toFixed(1)}⭐)`,
    }));
  }

  /**
   * 获取热门模板
   */
  async getPopularTemplates(limit: number = 10): Promise<SceneTemplate[]> {
    return this.browseTemplates({
      sortBy: 'popular',
      limit,
    });
  }

  /**
   * 获取最新模板
   */
  async getLatestTemplates(limit: number = 10): Promise<SceneTemplate[]> {
    return this.browseTemplates({
      sortBy: 'newest',
      limit,
    });
  }

  /**
   * 获取高评分模板
   */
  async getTopRatedTemplates(limit: number = 10): Promise<SceneTemplate[]> {
    return this.browseTemplates({
      minRating: 4.0,
      sortBy: 'rating',
      limit,
    });
  }

  // ============================================
  // 缓存管理
  // ============================================

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.templatesCache = null;
    this.templatesCacheExpiry = 0;
  }
}
