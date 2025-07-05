import { DatabaseService } from '../../../services/database';
import type { UserUsageStats } from '../../../types/database';

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 用量追踪器 - 基于Supabase数据库
 */
export class UsageTracker {
  private static instance: UsageTracker;
  private databaseService: DatabaseService;
  private cachedStats: UserUsageStats | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 30000; // 30秒缓存

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * 检查是否可以使用服务
   */
  async canUse(): Promise<UsageCheckResult> {
    try {
      const result = await this.databaseService.canUserGenerate();
      return result;
    } catch (error) {
      console.error('检查用量限制失败:', error);
      // 如果数据库出错，允许使用但记录错误
      return {
        allowed: true,
        reason: undefined,
      };
    }
  }

  /**
   * 记录使用情况
   */
  async recordUsage(): Promise<void> {
    try {
      await this.databaseService.recordUsage();
      // 清除缓存，强制下次获取最新数据
      this.cachedStats = null;
      this.lastCacheUpdate = 0;
    } catch (error) {
      console.error('记录使用失败:', error);
      // 不抛出错误，避免影响用户体验
    }
  }

  /**
   * 获取使用统计（带缓存）
   */
  async getUsageStats(): Promise<UserUsageStats> {
    const now = Date.now();
    
    // 如果缓存有效，直接返回缓存数据
    if (this.cachedStats && (now - this.lastCacheUpdate) < this.CACHE_DURATION) {
      return this.cachedStats;
    }

    try {
      const stats = await this.databaseService.getUserUsageStats();
      this.cachedStats = stats;
      this.lastCacheUpdate = now;
      return stats;
    } catch (error) {
      console.error('获取使用统计失败:', error);
      
      // 返回默认统计，避免阻塞用户
      const fallbackStats: UserUsageStats = {
        daily: {
          used: 0,
          limit: 10,
          remaining: 10,
        },
        total: {
          generated: 0,
          cost: 0,
          likes_received: 0,
          dislikes_received: 0,
          feedback_given: 0,
        },
      };

      // 如果有缓存数据，返回缓存数据
      return this.cachedStats || fallbackStats;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cachedStats = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * 获取每日剩余次数
   */
  async getDailyRemaining(): Promise<number> {
    const stats = await this.getUsageStats();
    return stats.daily.remaining;
  }

  /**
   * 获取每日使用次数
   */
  async getDailyUsed(): Promise<number> {
    const stats = await this.getUsageStats();
    return stats.daily.used;
  }

  /**
   * 获取每日配额
   */
  async getDailyLimit(): Promise<number> {
    const stats = await this.getUsageStats();
    return stats.daily.limit;
  }

  /**
   * 检查是否达到配额限制
   */
  async isQuotaExceeded(): Promise<boolean> {
    const result = await this.canUse();
    return !result.allowed;
  }

  /**
   * 获取配额使用百分比
   */
  async getUsagePercentage(): Promise<number> {
    const stats = await this.getUsageStats();
    if (stats.daily.limit === 0) return 0;
    return Math.round((stats.daily.used / stats.daily.limit) * 100);
  }
} 