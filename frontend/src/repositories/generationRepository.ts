/**
 * 生成记录仓库
 * 处理图片生成记录相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { Generation, TagCategory } from '../types/database';

export interface SaveGenerationParams {
  userId: string;
  prompt: string;
  model_name: string;
  model_cost: number;
  image_urls: string[];
  status?: 'pending' | 'completed' | 'failed';
  is_public?: boolean;
  tags_used?: Array<{ name: string; category: TagCategory; value: string }>;
  original_image_urls?: string[];
  r2_keys?: string[];
  r2_data?: any;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export class GenerationRepository extends BaseRepository {
  private static instance: GenerationRepository;

  private constructor() {
    super();
  }

  static getInstance(): GenerationRepository {
    if (!GenerationRepository.instance) {
      GenerationRepository.instance = new GenerationRepository();
    }
    return GenerationRepository.instance;
  }

  /**
   * 保存生成记录
   */
  async save(params: SaveGenerationParams): Promise<Generation> {
    const { data, error } = await this.supabase
      .from('generations')
      .insert({
        user_id: params.userId,
        prompt: params.prompt,
        model_name: params.model_name,
        model_cost: params.model_cost,
        image_urls: params.image_urls,
        status: params.status || 'completed',
        is_public: params.is_public !== false,
        original_image_urls: params.original_image_urls,
        r2_keys: params.r2_keys,
        r2_data: params.r2_data,
        tags_used: params.tags_used || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`保存生成记录失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取用户生成历史
   */
  async findByUserId(userId: string, limit: number = 50): Promise<Generation[]> {
    const { data, error } = await this.supabase
      .from('generations')
      .select(`
        id, user_id, prompt, model_name, model_cost, image_urls,
        status, created_at, is_public, original_image_urls,
        r2_keys, r2_data, tags_used, view_count, like_count, share_count, is_featured
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取生成历史失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 分页获取用户生成历史
   */
  async findByUserIdWithPagination(
    userId: string,
    options: { limit?: number; page?: number; offset?: number } = {}
  ): Promise<PaginationResult<Generation>> {
    const limit = options.limit || 10;
    const page = options.page || 1;
    const offset = options.offset !== undefined ? options.offset : (page - 1) * limit;

    // 获取总数
    const { count, error: countError } = await this.supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw new Error(`获取总数失败: ${countError.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    // 获取分页数据
    const { data, error } = await this.supabase
      .from('generations')
      .select(`
        id, user_id, prompt, model_name, model_cost, image_urls,
        status, created_at, is_public, original_image_urls,
        r2_keys, r2_data, tags_used, view_count, like_count, share_count, is_featured
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`获取分页历史失败: ${error.message}`);
    }

    return {
      data: data || [],
      total,
      hasMore,
      currentPage: page,
      totalPages,
    };
  }

  /**
   * 获取公开的生成记录
   */
  async findPublic(limit: number = 100): Promise<Generation[]> {
    const { data, error } = await this.supabase
      .from('generations')
      .select(`
        id, prompt, model_name, image_urls, status, created_at,
        is_public, original_image_urls, r2_keys, r2_data, tags_used,
        view_count, like_count, share_count, is_featured
      `)
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取公开生成记录失败: ${error.message}`);
    }

    // 为公开记录添加匿名 user_id 和默认 model_cost
    return (data || []).map((record: any) => ({
      ...record,
      user_id: 'anonymous',
      model_cost: 0,
      view_count: record.view_count || 0,
      like_count: record.like_count || 0,
      share_count: record.share_count || 0,
      is_featured: record.is_featured || false,
    }));
  }

  /**
   * 分页获取公开的生成记录
   */
  async findPublicWithPagination(
    options: { limit?: number; page?: number; offset?: number } = {}
  ): Promise<PaginationResult<Generation>> {
    const limit = options.limit || 24;
    const page = options.page || 1;
    const offset = options.offset !== undefined ? options.offset : (page - 1) * limit;

    // 获取总数
    const { count, error: countError } = await this.supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'completed');

    if (countError) {
      throw new Error(`获取公开记录总数失败: ${countError.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    // 获取分页数据
    const { data, error } = await this.supabase
      .from('generations')
      .select(`
        id, prompt, model_name, image_urls, status, created_at,
        is_public, original_image_urls, r2_keys, r2_data, tags_used,
        view_count, like_count, share_count, is_featured
      `)
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`获取分页公开记录失败: ${error.message}`);
    }

    // 为公开记录添加匿名 user_id 和默认值
    const mappedData = (data || []).map((record: any) => ({
      ...record,
      user_id: 'anonymous',
      model_cost: 0,
      view_count: record.view_count || 0,
      like_count: record.like_count || 0,
      share_count: record.share_count || 0,
      is_featured: record.is_featured || false,
    }));

    return {
      data: mappedData,
      total,
      hasMore,
      currentPage: page,
      totalPages,
    };
  }

  /**
   * 获取今日生成记录（调试用）
   */
  async findTodayGenerations(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('generations')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${tomorrow}T00:00:00`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取今日生成记录失败:', error);
      return [];
    }

    return data || [];
  }
}
