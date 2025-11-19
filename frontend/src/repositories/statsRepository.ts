/**
 * 统计仓库
 * 处理每日统计和提示词统计相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { DailyStats, PromptStats } from '../types/database';

export class StatsRepository extends BaseRepository {
  private static instance: StatsRepository;

  private constructor() {
    super();
  }

  static getInstance(): StatsRepository {
    if (!StatsRepository.instance) {
      StatsRepository.instance = new StatsRepository();
    }
    return StatsRepository.instance;
  }

  // ===== 每日统计 =====

  /**
   * 获取指定日期的统计记录
   */
  async findDailyStatsByDate(date: string): Promise<DailyStats | null> {
    const { data, error } = await this.supabase
      .from('daily_stats')
      .select('*')
      .eq('date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`获取每日统计失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 创建每日统计记录
   */
  async createDailyStats(stats: {
    date: string;
    total_generations: number;
    total_users: number;
    total_cost: number;
    popular_prompts?: any[];
  }): Promise<void> {
    const { error } = await this.supabase
      .from('daily_stats')
      .insert(stats);

    if (error) {
      throw new Error(`创建每日统计失败: ${error.message}`);
    }
  }

  /**
   * 更新每日统计记录
   */
  async updateDailyStats(
    statsId: string,
    updates: Partial<DailyStats>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('daily_stats')
      .update(updates)
      .eq('id', statsId);

    if (error) {
      throw new Error(`更新每日统计失败: ${error.message}`);
    }
  }

  /**
   * 获取最近几天的统计
   */
  async findRecentDailyStats(days: number = 7): Promise<DailyStats[]> {
    const { data, error } = await this.supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(days);

    if (error) {
      throw new Error(`获取每日统计失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取所有每日统计（用于清理重复记录）
   */
  async findAllDailyStats(): Promise<DailyStats[]> {
    const { data, error } = await this.supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`获取每日统计失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 删除指定的每日统计记录
   */
  async deleteDailyStats(statsId: string): Promise<void> {
    const { error } = await this.supabase
      .from('daily_stats')
      .delete()
      .eq('id', statsId);

    if (error) {
      console.error(`删除记录 ${statsId} 失败:`, error);
    }
  }

  // ===== 提示词统计 =====

  /**
   * 更新或创建提示词统计
   */
  async upsertPromptStats(promptText: string): Promise<void> {
    const currentTime = new Date().toISOString();

    const { error } = await this.supabase
      .from('prompt_stats')
      .upsert({
        prompt_text: promptText,
        usage_count: 1,
        last_used: currentTime,
        average_rating: 0,
      }, {
        onConflict: 'prompt_text',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('提示词统计 upsert 失败:', error);
      // 降级处理：直接插入
      await this.insertPromptStats(promptText);
    }
  }

  /**
   * 插入提示词统计（降级方法）
   */
  private async insertPromptStats(promptText: string): Promise<void> {
    const { error } = await this.supabase
      .from('prompt_stats')
      .insert({
        prompt_text: promptText,
        usage_count: 1,
        last_used: new Date().toISOString(),
        average_rating: 0,
      });

    if (error) {
      console.warn('提示词统计插入失败（可能已存在）:', error.message);
    }
  }

  /**
   * 获取热门提示词
   */
  async findPopularPrompts(limit: number = 10): Promise<PromptStats[]> {
    const { data, error } = await this.supabase
      .from('prompt_stats')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取热门提示词失败: ${error.message}`);
    }

    return data || [];
  }
}
