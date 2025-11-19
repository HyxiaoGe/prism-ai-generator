/**
 * 标签仓库
 * 处理标签统计相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { TagStats, TagCategory } from '../types/database';

export interface TagInput {
  name: string;
  category: TagCategory;
  value: string;
}

export class TagRepository extends BaseRepository {
  private static instance: TagRepository;

  private constructor() {
    super();
  }

  static getInstance(): TagRepository {
    if (!TagRepository.instance) {
      TagRepository.instance = new TagRepository();
    }
    return TagRepository.instance;
  }

  /**
   * 批量更新标签统计（使用 upsert）
   */
  async upsertMany(tags: TagInput[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    const currentTime = new Date().toISOString();
    const upsertData = tags.map(tag => ({
      tag_name: tag.name,
      tag_category: tag.category,
      tag_value: tag.value,
      usage_count: 1,
      success_rate: 0,
      average_rating: 0,
      last_used: currentTime,
      updated_at: currentTime,
    }));

    const { error } = await this.supabase
      .from('tag_stats')
      .upsert(upsertData, {
        onConflict: 'tag_name,tag_category',
        ignoreDuplicates: true,
      });

    if (error) {
      throw new Error(`批量更新标签统计失败: ${error.message}`);
    }
  }

  /**
   * 获取热门标签
   */
  async findPopular(category?: TagCategory, limit: number = 10): Promise<TagStats[]> {
    let query = this.supabase
      .from('tag_stats')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('tag_category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取热门标签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取标签推荐
   */
  async findRecommendations(
    usedTags: string[] = [],
    category?: TagCategory,
    limit: number = 5
  ): Promise<TagStats[]> {
    let query = this.supabase
      .from('tag_stats')
      .select('*')
      .gt('usage_count', 0)
      .order('usage_count', { ascending: false })
      .limit(limit * 2);

    if (category) {
      query = query.eq('tag_category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取标签推荐失败: ${error.message}`);
    }

    // 过滤掉已使用的标签
    return (data || [])
      .filter((tag: any) => !usedTags.includes(tag.tag_name))
      .slice(0, limit);
  }

  /**
   * 按分类获取标签统计
   */
  async findByCategory(category: TagCategory, limit: number = 10): Promise<TagStats[]> {
    const { data, error } = await this.supabase
      .from('tag_stats')
      .select('*')
      .eq('tag_category', category)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`获取 ${category} 标签失败:`, error);
      return [];
    }

    return data || [];
  }

  /**
   * 更新标签成功率
   */
  async updateSuccessRate(tagName: string, successRate: number, averageRating: number): Promise<void> {
    const { error } = await this.supabase
      .from('tag_stats')
      .update({
        success_rate: successRate,
        average_rating: averageRating,
      })
      .eq('tag_name', tagName);

    if (error) {
      console.error(`更新标签 ${tagName} 成功率失败:`, error);
    }
  }

  /**
   * 批量更新标签成功率
   */
  async batchUpdateSuccessRates(
    updates: Array<{ tagName: string; successRate: number; averageRating: number }>
  ): Promise<void> {
    const promises = updates.map(update =>
      this.supabase
        .from('tag_stats')
        .update({
          success_rate: update.successRate,
          average_rating: update.averageRating,
        })
        .eq('tag_name', update.tagName)
    );

    await Promise.allSettled(promises);
  }

  /**
   * 更新标签名称
   */
  async updateTagName(oldName: string, newName: string): Promise<void> {
    const { error } = await this.supabase
      .from('tag_stats')
      .update({ tag_name: newName })
      .eq('tag_name', oldName);

    if (error) {
      console.error(`更新标签名称失败 "${oldName}" -> "${newName}":`, error);
    }
  }
}
