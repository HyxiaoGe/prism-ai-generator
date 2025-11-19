/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */

import { UserRepository } from '../../repositories';
import { FeedbackRepository } from '../../repositories';
import type { User, UserUsageStats } from '../../types/database';

export class UserService {
  private static instance: UserService;
  private userRepository: UserRepository;
  private feedbackRepository: FeedbackRepository;

  // 用户缓存
  private cachedUser: User | null = null;
  private userCacheExpiry: number = 0;
  private readonly USER_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {
    this.userRepository = UserRepository.getInstance();
    this.feedbackRepository = FeedbackRepository.getInstance();
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * 获取或创建用户（带缓存）
   */
  async getOrCreateUser(): Promise<User> {
    const now = Date.now();

    // 检查缓存是否有效
    if (this.cachedUser && now < this.userCacheExpiry) {
      console.log('📈 使用缓存的用户信息，避免数据库查询');
      return this.cachedUser;
    }

    console.log('🔄 缓存过期或不存在，从数据库获取用户信息');
    const fingerprint = await this.userRepository.getCurrentFingerprint();

    // 查找现有用户
    let user = await this.userRepository.findByFingerprint(fingerprint);

    if (user) {
      // 检查是否需要重置每日配额
      const today = new Date().toISOString().split('T')[0];
      if (user.last_reset_date !== today) {
        user = await this.userRepository.resetDailyQuota(user.id);
        console.log('✅ 用户配额重置成功并已缓存');
      } else {
        console.log('✅ 现有用户信息已缓存');
      }
    } else {
      // 创建新用户
      user = await this.userRepository.create(fingerprint);
      console.log('✅ 新用户创建成功并已缓存');
    }

    // 更新缓存
    this.cachedUser = user;
    this.userCacheExpiry = now + this.USER_CACHE_DURATION;

    return user;
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(): Promise<UserUsageStats> {
    const user = await this.getOrCreateUser();

    // 获取反馈统计
    const feedbacks = await this.feedbackRepository.findByUserId(user.id);

    const likesReceived = feedbacks.filter((f: any) => f.feedback_type === 'like').length;
    const dislikesReceived = feedbacks.filter((f: any) => f.feedback_type === 'dislike').length;
    const feedbackGiven = feedbacks.length;

    return {
      daily: {
        used: user.used_today,
        limit: user.daily_quota,
        remaining: user.daily_quota - user.used_today,
      },
      total: {
        generated: user.total_generated,
        cost: 0,
        likes_received: likesReceived,
        dislikes_received: dislikesReceived,
        feedback_given: feedbackGiven,
      },
    };
  }

  /**
   * 检查用户是否可以生成图像
   */
  async canUserGenerate(): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.getOrCreateUser();

    if (user.used_today >= user.daily_quota) {
      return {
        allowed: false,
        reason: `每日配额已用完 (${user.used_today}/${user.daily_quota})`,
      };
    }

    return { allowed: true };
  }

  /**
   * 记录用户使用
   */
  async recordUsage(userId?: string): Promise<void> {
    const user = userId
      ? await this.userRepository.findById(userId)
      : await this.getOrCreateUser();

    if (!user) {
      throw new Error('用户不存在');
    }

    await this.userRepository.incrementUsage(user.id, user.used_today, user.total_generated);

    // 清除用户缓存
    this.clearUserCache();
    console.log('🔄 用户使用量已更新，缓存已清除');
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  /**
   * 清除用户缓存
   */
  private clearUserCache(): void {
    this.cachedUser = null;
    this.userCacheExpiry = 0;
  }

  /**
   * 获取用户反馈统计
   */
  async getUserFeedbackStats(userId?: string): Promise<{
    total_feedback: number;
    likes_given: number;
    dislikes_given: number;
    feedback_rate: number;
  }> {
    const user = userId
      ? await this.userRepository.findById(userId)
      : await this.getOrCreateUser();

    if (!user) {
      return {
        total_feedback: 0,
        likes_given: 0,
        dislikes_given: 0,
        feedback_rate: 0,
      };
    }

    const feedbacks = await this.feedbackRepository.findByUserId(user.id);

    const totalFeedback = feedbacks.length;
    const likesGiven = feedbacks.filter((f: any) => f.feedback_type === 'like').length;
    const dislikesGiven = feedbacks.filter((f: any) => f.feedback_type === 'dislike').length;
    const feedbackRate = user.total_generated > 0 ? totalFeedback / user.total_generated : 0;

    return {
      total_feedback: totalFeedback,
      likes_given: likesGiven,
      dislikes_given: dislikesGiven,
      feedback_rate: feedbackRate,
    };
  }
}
