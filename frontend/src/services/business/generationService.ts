/**
 * 生成记录服务
 * 处理图片生成记录相关的业务逻辑
 */

import { GenerationRepository, StatsRepository, TagRepository } from '../../repositories';
import { AuthService } from '../auth/authService';
import type { Generation, TagCategory } from '../../types/database';
import type { PaginationResult } from '../../repositories';

export class GenerationService {
  private static instance: GenerationService;
  private generationRepository: GenerationRepository;
  private statsRepository: StatsRepository;
  private tagRepository: TagRepository;
  private authService: AuthService;

  private constructor() {
    this.generationRepository = GenerationRepository.getInstance();
    this.statsRepository = StatsRepository.getInstance();
    this.tagRepository = TagRepository.getInstance();
    this.authService = AuthService.getInstance();
  }

  static getInstance(): GenerationService {
    if (!GenerationService.instance) {
      GenerationService.instance = new GenerationService();
    }
    return GenerationService.instance;
  }

  /**
   * 保存生成记录
   */
  async saveGeneration(params: {
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
  }): Promise<Generation> {
    // 使用 AuthService.getAppUser() 获取当前用户（已登录用户或匿名用户）
    const user = await this.authService.getAppUser();

    if (!user) {
      throw new Error('无法获取用户信息');
    }

    const generation = await this.generationRepository.save({
      userId: user.id,
      ...params,
    });

    // 异步更新每日统计，不阻塞主流程
    this.updateDailyStats().catch(error => {
      console.error('更新每日统计失败:', error);
    });

    // 异步更新标签使用统计
    if (params.tags_used && params.tags_used.length > 0) {
      this.tagRepository.upsertMany(params.tags_used).catch(error => {
        console.error('更新标签统计失败:', error);
      });
    }

    return generation;
  }

  /**
   * 获取用户生成历史
   */
  async getUserGenerations(limit: number = 50): Promise<Generation[]> {
    const user = await this.authService.getAppUser();
    if (!user) {
      throw new Error('无法获取用户信息');
    }
    return this.generationRepository.findByUserId(user.id, limit);
  }

  /**
   * 分页获取用户生成历史
   */
  async getUserGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number;
  } = {}): Promise<PaginationResult<Generation>> {
    const user = await this.authService.getAppUser();
    if (!user) {
      throw new Error('无法获取用户信息');
    }

    const result = await this.generationRepository.findByUserIdWithPagination(user.id, params);

    return result;
  }

  /**
   * 获取公开的生成记录
   */
  async getPublicGenerations(limit: number = 100): Promise<Generation[]> {
    return this.generationRepository.findPublic(limit);
  }

  /**
   * 分页获取公开的生成记录
   */
  async getPublicGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number;
  } = {}): Promise<PaginationResult<Generation>> {
    const result = await this.generationRepository.findPublicWithPagination(params);

    console.log(`📄 分页加载公开画廊: 第${result.currentPage}页, ${result.data.length}/${result.total}条记录`);

    return result;
  }

  /**
   * 更新每日统计
   */
  async updateDailyStats(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // 获取今日生成记录
    const generationsToday = await this.generationRepository.findTodayGenerations();

    // 只统计完成的记录
    const completedGenerations = generationsToday.filter(r => r.status === 'completed');

    // 统计数据
    const uniqueUserIds = new Set(completedGenerations.map(gen => gen.user_id));
    const totalGenerations = completedGenerations.length;
    const totalActiveUsers = uniqueUserIds.size;
    const totalCost = completedGenerations.reduce((sum, gen) => sum + (gen.model_cost || 0), 0);

    const statsData = {
      date: today,
      total_generations: totalGenerations,
      total_users: totalActiveUsers,
      total_cost: totalCost,
      popular_prompts: [],
    };

    // 检查是否已存在今日统计记录
    const existingStats = await this.statsRepository.findDailyStatsByDate(today);

    if (existingStats) {
      await this.statsRepository.updateDailyStats(existingStats.id, statsData);
    } else {
      await this.statsRepository.createDailyStats(statsData);
    }
  }

  /**
   * 获取每日统计
   */
  async getDailyStats(days: number = 7) {
    return this.statsRepository.findRecentDailyStats(days);
  }

  /**
   * 更新或创建提示词统计
   */
  async updatePromptStats(promptText: string): Promise<void> {
    console.log('📊 优化提示词统计更新:', promptText.substring(0, 50) + '...');
    await this.statsRepository.upsertPromptStats(promptText);
    console.log('✅ 提示词统计优化更新完成');
  }

  /**
   * 获取热门提示词
   */
  async getPopularPrompts(limit: number = 10) {
    return this.statsRepository.findPopularPrompts(limit);
  }

  /**
   * 调试方法：获取今日所有生成记录详情
   */
  async getDebugGenerationsToday(): Promise<any> {
    const data = await this.generationRepository.findTodayGenerations();

    console.log('🔍 今日所有生成记录:', data);
    console.log('📊 记录统计:', {
      总记录数: data.length,
      完成记录数: data.filter(r => r.status === 'completed').length,
      失败记录数: data.filter(r => r.status === 'failed').length,
      待处理记录数: data.filter(r => r.status === 'pending').length,
    });

    return data;
  }

  /**
   * 清理重复的每日统计记录
   */
  async cleanupDuplicateDailyStats(): Promise<void> {
    console.log('🧹 开始清理重复的每日统计记录...');

    const allStats = await this.statsRepository.findAllDailyStats();

    if (!allStats || allStats.length === 0) {
      console.log('📭 没有找到每日统计记录');
      return;
    }

    // 按日期分组
    const statsByDate = new Map<string, any[]>();
    allStats.forEach(stat => {
      const date = stat.date;
      if (!statsByDate.has(date)) {
        statsByDate.set(date, []);
      }
      statsByDate.get(date)!.push(stat);
    });

    // 清理重复记录
    for (const [date, records] of statsByDate.entries()) {
      if (records.length > 1) {
        console.log(`🔍 发现 ${date} 有 ${records.length} 条重复记录，准备清理...`);

        // 按创建时间排序，保留最新的一条
        records.sort((a, b) =>
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );

        const deleteRecords = records.slice(1);

        for (const record of deleteRecords) {
          await this.statsRepository.deleteDailyStats(record.id);
          console.log(`✅ 已删除记录 ${record.id}`);
        }
      }
    }

    console.log('🎉 重复记录清理完成！');
  }
}
