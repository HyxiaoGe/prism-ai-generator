/**
 * 场景模板仓库
 * 处理场景模板相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type {
  SceneTemplate,
  UserTemplateFavorite,
  TemplateRating,
  TemplateUsageHistory,
  TemplateDifficulty,
} from '../types/database';

// 模板查询过滤器
export interface TemplateFilter {
  category?: string;
  subcategory?: string;
  difficulty?: TemplateDifficulty;
  tags?: string[];
  isOfficial?: boolean;
  searchQuery?: string;
  minRating?: number;
}

// 排序选项
export type TemplateSortBy = 'popular' | 'newest' | 'rating' | 'usage';

// 分页结果
export interface PaginationResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export class SceneTemplateRepository extends BaseRepository {
  private static instance: SceneTemplateRepository;

  private constructor() {
    super();
  }

  static getInstance(): SceneTemplateRepository {
    if (!SceneTemplateRepository.instance) {
      SceneTemplateRepository.instance = new SceneTemplateRepository();
    }
    return SceneTemplateRepository.instance;
  }

  // ============================================
  // 模板查询
  // ============================================

  /**
   * 获取所有活跃的模板
   */
  async findAll(sortBy: TemplateSortBy = 'popular'): Promise<SceneTemplate[]> {
    let query = this.supabase
      .from('scene_templates')
      .select('*')
      .eq('status', 'active')
      .eq('is_public', true);

    // 根据排序方式调整查询
    switch (sortBy) {
      case 'popular':
        query = query.order('usage_count', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'usage':
        query = query.order('usage_count', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取模板列表失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 根据过滤器查询模板
   */
  async findByFilter(
    filter: TemplateFilter,
    sortBy: TemplateSortBy = 'popular',
    limit: number = 50
  ): Promise<SceneTemplate[]> {
    let query = this.supabase
      .from('scene_templates')
      .select('*')
      .eq('status', 'active')
      .eq('is_public', true);

    // 应用过滤条件
    if (filter.category) {
      query = query.eq('category', filter.category);
    }
    if (filter.subcategory) {
      query = query.eq('subcategory', filter.subcategory);
    }
    if (filter.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }
    if (filter.isOfficial !== undefined) {
      query = query.eq('is_official', filter.isOfficial);
    }
    if (filter.minRating) {
      query = query.gte('rating', filter.minRating);
    }
    if (filter.tags && filter.tags.length > 0) {
      // 使用 contains 查询数组字段
      query = query.contains('tags', filter.tags);
    }
    if (filter.searchQuery) {
      // 使用 ilike 进行模糊搜索（名称或描述）
      query = query.or(
        `name.ilike.%${filter.searchQuery}%,description.ilike.%${filter.searchQuery}%`
      );
    }

    // 排序
    switch (sortBy) {
      case 'popular':
        query = query.order('usage_count', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'usage':
        query = query.order('usage_count', { ascending: false });
        break;
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('根据过滤器查询模板失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 根据ID获取模板
   */
  async findById(templateId: string): Promise<SceneTemplate | null> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (error) {
      console.error('获取模板详情失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 获取所有可用的分类
   */
  async getCategories(): Promise<Array<{ category: string; subcategory: string | null; count: number }>> {
    const { data, error } = await this.supabase
      .from('scene_templates')
      .select('category, subcategory')
      .eq('status', 'active')
      .eq('is_public', true);

    if (error) {
      console.error('获取分类列表失败:', error);
      return [];
    }

    // 统计每个分类的数量
    const categoryMap = new Map<string, { category: string; subcategory: string | null; count: number }>();

    data?.forEach(item => {
      const key = `${item.category}|${item.subcategory || ''}`;
      const existing = categoryMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(key, {
          category: item.category,
          subcategory: item.subcategory,
          count: 1,
        });
      }
    });

    return Array.from(categoryMap.values());
  }

  /**
   * 更新模板使用次数
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    // 先获取当前使用次数
    const { data: template } = await this.supabase
      .from('scene_templates')
      .select('usage_count')
      .eq('id', templateId)
      .single();

    if (!template) {
      console.error('模板不存在:', templateId);
      return;
    }

    // 更新使用次数
    const { error } = await this.supabase
      .from('scene_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', templateId);

    if (error) {
      console.error('更新模板使用次数失败:', error);
    }
  }

  // ============================================
  // 收藏相关
  // ============================================

  /**
   * 添加收藏
   */
  async addFavorite(userId: string, templateId: string, notes?: string): Promise<UserTemplateFavorite | null> {
    const { data, error } = await this.supabase
      .from('user_template_favorites')
      .insert({
        user_id: userId,
        template_id: templateId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('添加收藏失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 删除收藏
   */
  async removeFavorite(userId: string, templateId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('user_template_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('template_id', templateId);

    if (error) {
      console.error('删除收藏失败:', error);
      return false;
    }

    return true;
  }

  /**
   * 检查是否已收藏
   */
  async isFavorited(userId: string, templateId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('user_template_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('template_id', templateId)
      .maybeSingle();

    if (error) {
      console.error('检查收藏状态失败:', error);
      return false;
    }

    return !!data;
  }

  /**
   * 批量检查多个模板的收藏状态
   */
  async getFavoriteStatusMap(userId: string, templateIds: string[]): Promise<Map<string, boolean>> {
    if (templateIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from('user_template_favorites')
      .select('template_id')
      .eq('user_id', userId)
      .in('template_id', templateIds);

    if (error) {
      console.error('批量检查收藏状态失败:', error);
      return new Map();
    }

    // 创建一个 Map，标记哪些模板已收藏
    const favoriteMap = new Map<string, boolean>();
    const favoritedIds = new Set(data?.map(item => item.template_id) || []);

    templateIds.forEach(id => {
      favoriteMap.set(id, favoritedIds.has(id));
    });

    return favoriteMap;
  }

  /**
   * 获取用户收藏列表
   */
  async getFavorites(userId: string): Promise<SceneTemplate[]> {
    const { data, error } = await this.supabase
      .from('user_template_favorites')
      .select(`
        template_id,
        scene_templates (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取收藏列表失败:', error);
      return [];
    }

    // 提取模板数据
    return data?.map((item: any) => item.scene_templates).filter(Boolean) || [];
  }

  // ============================================
  // 评分相关
  // ============================================

  /**
   * 添加或更新评分
   */
  async upsertRating(
    userId: string,
    templateId: string,
    rating: number,
    review?: string
  ): Promise<TemplateRating | null> {
    // 先查询是否已经评分过
    const { data: existing } = await this.supabase
      .from('template_ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('template_id', templateId)
      .maybeSingle();

    if (existing) {
      // 更新已有评分
      const { data, error } = await this.supabase
        .from('template_ratings')
        .update({
          rating,
          review: review || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('更新评分失败:', error);
        return null;
      }

      return data;
    } else {
      // 新增评分
      const { data, error } = await this.supabase
        .from('template_ratings')
        .insert({
          user_id: userId,
          template_id: templateId,
          rating,
          review: review || null,
          helpful_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('添加评分失败:', error);
        return null;
      }

      return data;
    }
  }

  /**
   * 获取用户对模板的评分
   */
  async getUserRating(userId: string, templateId: string): Promise<TemplateRating | null> {
    const { data, error } = await this.supabase
      .from('template_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('template_id', templateId)
      .maybeSingle();

    if (error) {
      console.error('获取用户评分失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 获取模板的所有评分
   */
  async getTemplateRatings(templateId: string, limit: number = 20): Promise<TemplateRating[]> {
    const { data, error } = await this.supabase
      .from('template_ratings')
      .select('*')
      .eq('template_id', templateId)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('获取模板评分列表失败:', error);
      return [];
    }

    return data || [];
  }

  // ============================================
  // 使用历史
  // ============================================

  /**
   * 记录模板使用
   */
  async recordUsage(
    userId: string,
    templateId: string,
    options?: {
      generationId?: string;
      customModifications?: string;
      wasSuccessful?: boolean;
      userRating?: number;
    }
  ): Promise<TemplateUsageHistory | null> {
    const { data, error } = await this.supabase
      .from('template_usage_history')
      .insert({
        user_id: userId,
        template_id: templateId,
        generation_id: options?.generationId || null,
        custom_modifications: options?.customModifications || null,
        was_successful: options?.wasSuccessful !== false,
        user_rating: options?.userRating || null,
      })
      .select()
      .single();

    if (error) {
      console.error('记录使用历史失败:', error);
      return null;
    }

    // 同时更新使用次数
    await this.incrementUsageCount(templateId);

    return data;
  }

  /**
   * 获取用户使用历史
   */
  async getUserUsageHistory(userId: string, limit: number = 50): Promise<TemplateUsageHistory[]> {
    const { data, error } = await this.supabase
      .from('template_usage_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('获取使用历史失败:', error);
      return [];
    }

    return data || [];
  }
}
