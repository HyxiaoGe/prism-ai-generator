/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */

import { UserRepository } from '../../repositories';
import { FeedbackRepository } from '../../repositories';
import type { User, UserUsageStats, AuthProvider } from '../../types/database';

export class UserService {
  private static instance: UserService;
  private userRepository: UserRepository;
  private feedbackRepository: FeedbackRepository;
  private authService: any; // 延迟导入避免循环依赖

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
   * 默认使用设备指纹认证
   */
  async getOrCreateUser(): Promise<User> {
    const now = Date.now();

    // 检查缓存是否有效
    if (this.cachedUser && now < this.userCacheExpiry) {
      return this.cachedUser;
    }

    const fingerprint = await this.userRepository.getCurrentFingerprint();

    // 查找现有用户（通过设备指纹）
    let user = await this.userRepository.findByFingerprint(fingerprint);

    if (user) {
      // 检查是否需要重置每日配额
      const today = new Date().toISOString().split('T')[0];
      if (user.last_reset_date !== today) {
        user = await this.userRepository.resetDailyQuota(user.id);
      }
    } else {
      // 创建新用户（使用设备指纹作为认证方式）
      user = await this.userRepository.create('device', fingerprint);
    }

    // 更新缓存
    this.cachedUser = user;
    this.userCacheExpiry = now + this.USER_CACHE_DURATION;

    return user;
  }

  /**
   * 通过 OAuth 获取或创建用户
   */
  async getOrCreateUserByOAuth(
    provider: AuthProvider,
    providerUserId: string,
    options?: {
      displayName?: string;
      email?: string;
      avatarUrl?: string;
      providerEmail?: string;
      providerData?: Record<string, any>;
    }
  ): Promise<User> {
    // 查找现有用户
    let user = await this.userRepository.findByAuthProvider(provider, providerUserId);

    if (user) {
      // 检查是否需要重置每日配额
      const today = new Date().toISOString().split('T')[0];
      if (user.last_reset_date !== today) {
        user = await this.userRepository.resetDailyQuota(user.id);
      }

      // 更新用户信息（如果有新数据）
      if (options?.displayName || options?.email || options?.avatarUrl) {
        user = await this.userRepository.update(user.id, {
          display_name: options.displayName || user.display_name,
          email: options.email || user.email,
          avatar_url: options.avatarUrl || user.avatar_url,
        });
      }
    } else {
      // 创建新用户
      user = await this.userRepository.create(provider, providerUserId, options);
    }

    // 更新缓存
    this.cachedUser = user;
    this.userCacheExpiry = Date.now() + this.USER_CACHE_DURATION;

    return user;
  }

  /**
   * 绑定新的认证方式到当前用户
   */
  async linkAuthProvider(
    provider: AuthProvider,
    providerUserId: string,
    options?: {
      providerEmail?: string;
      providerData?: Record<string, any>;
    }
  ): Promise<void> {
    const user = await this.getOrCreateUser();
    await this.userRepository.linkAuthAccount(user.id, provider, providerUserId, options);
    console.log(`✅ 成功绑定 ${provider} 账号`);
  }

  /**
   * 获取当前用户的所有认证方式
   */
  async getAuthAccounts(): Promise<Array<{ provider: AuthProvider; email?: string }>> {
    const user = await this.getOrCreateUser();
    const accounts = await this.userRepository.findAuthAccounts(user.id);
    return accounts.map(a => ({
      provider: a.provider,
      email: a.provider_email || undefined,
    }));
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(): Promise<UserUsageStats> {
    // 使用 AuthService.getAppUser() 获取当前用户
    const { AuthService } = await import('../auth/authService');
    const authService = AuthService.getInstance();
    const user = await authService.getAppUser();

    if (!user) {
      throw new Error('无法获取用户信息');
    }

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
    let user: User | null;

    if (userId) {
      user = await this.userRepository.findById(userId);
    } else {
      // 使用 AuthService.getAppUser() 获取当前用户（已登录或匿名）
      const { AuthService } = await import('../auth/authService');
      const authService = AuthService.getInstance();
      user = await authService.getAppUser();
    }

    if (!user) {
      throw new Error('用户不存在');
    }

    await this.userRepository.incrementUsage(user.id, user.used_today, user.total_generated);

    // 清除用户缓存
    this.clearUserCache();
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
  clearUserCache(): void {
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
