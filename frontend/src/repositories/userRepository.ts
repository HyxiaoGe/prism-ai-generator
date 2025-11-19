/**
 * 用户仓库
 * 处理用户相关的数据库操作
 */

import { BaseRepository, DeviceFingerprint } from './baseRepository';
import type { User, AuthAccount, AuthProvider } from '../types/database';

export class UserRepository extends BaseRepository {
  private static instance: UserRepository;
  private deviceFingerprint: DeviceFingerprint;

  private constructor() {
    super();
    this.deviceFingerprint = DeviceFingerprint.getInstance();
  }

  static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  // ============================================
  // 用户查询方法
  // ============================================

  /**
   * 根据认证提供商和用户ID获取用户
   * 这是主要的用户查询方法
   */
  async findByAuthProvider(provider: AuthProvider, providerUserId: string): Promise<User | null> {
    // 先查询 auth_accounts 表
    const { data: authAccount, error: authError } = await this.supabase
      .from('auth_accounts')
      .select('user_id')
      .eq('provider', provider)
      .eq('provider_user_id', providerUserId)
      .single();

    if (authError) {
      if (authError.code === 'PGRST116') {
        return null; // 未找到
      }
      throw new Error(`查询认证账号失败: ${authError.message}`);
    }

    // 再查询 users 表
    return this.findById(authAccount.user_id);
  }

  /**
   * 根据设备指纹获取用户（便捷方法）
   */
  async findByFingerprint(fingerprint: string): Promise<User | null> {
    return this.findByAuthProvider('device', fingerprint);
  }

  /**
   * 根据 ID 获取用户
   */
  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`获取用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 根据邮箱获取用户
   * 用于账号关联（同一邮箱的不同 OAuth 提供商）
   */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 未找到
      }
      throw new Error(`按邮箱查询用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取用户的所有认证账号
   */
  async findAuthAccounts(userId: string): Promise<AuthAccount[]> {
    const { data, error } = await this.supabase
      .from('auth_accounts')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`获取认证账号失败: ${error.message}`);
    }

    return data || [];
  }

  // ============================================
  // 用户创建方法
  // ============================================

  /**
   * 创建新用户（包含认证账号）
   */
  async create(
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
    // 根据认证提供商设置每日配额
    const dailyQuota = this.getQuotaByProvider(provider);

    // 1. 创建 users 记录
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .insert({
        display_name: options?.displayName || null,
        email: options?.email || null,
        avatar_url: options?.avatarUrl || null,
        daily_quota: dailyQuota,
        used_today: 0,
        last_reset_date: new Date().toISOString().split('T')[0],
        total_generated: 0,
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`创建用户失败: ${userError.message}`);
    }

    // 2. 创建 auth_accounts 记录
    const { error: authError } = await this.supabase
      .from('auth_accounts')
      .insert({
        user_id: user.id,
        provider,
        provider_user_id: providerUserId,
        provider_email: options?.providerEmail || null,
        provider_data: options?.providerData || null,
      });

    if (authError) {
      // 回滚：删除刚创建的用户
      await this.supabase.from('users').delete().eq('id', user.id);
      throw new Error(`创建认证账号失败: ${authError.message}`);
    }

    return user;
  }

  /**
   * 为用户添加新的认证方式
   * 用于账号绑定（如匿名用户绑定 Google 账号）
   */
  async linkAuthAccount(
    userId: string,
    provider: AuthProvider,
    providerUserId: string,
    options?: {
      providerEmail?: string;
      providerData?: Record<string, any>;
    }
  ): Promise<AuthAccount> {
    // 检查是否已存在相同的认证账号
    const existing = await this.findByAuthProvider(provider, providerUserId);
    if (existing) {
      if (existing.id === userId) {
        // 已经绑定到当前用户，返回现有账号
        const accounts = await this.findAuthAccounts(userId);
        const account = accounts.find(a => a.provider === provider && a.provider_user_id === providerUserId);
        if (account) return account;
      }
      throw new Error(`该 ${provider} 账号已绑定到其他用户`);
    }

    const { data, error } = await this.supabase
      .from('auth_accounts')
      .insert({
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        provider_email: options?.providerEmail || null,
        provider_data: options?.providerData || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`绑定认证账号失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 解绑认证账号
   * 用于用户手动解除绑定
   */
  async unlinkAuthAccount(accountId: string): Promise<void> {
    const { error } = await this.supabase
      .from('auth_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      throw new Error(`解绑认证账号失败: ${error.message}`);
    }
  }

  // ============================================
  // 用户更新方法
  // ============================================

  /**
   * 更新用户信息
   */
  async update(userId: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> {
    // 移除 updated_at，让数据库触发器处理
    const { updated_at, ...cleanUpdates } = updates as any;

    const { data, error } = await this.supabase
      .from('users')
      .update(cleanUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 重置每日配额
   */
  async resetDailyQuota(userId: string): Promise<User> {
    const today = new Date().toISOString().split('T')[0];
    return this.update(userId, {
      used_today: 0,
      last_reset_date: today,
    });
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(userId: string, currentUsedToday: number, currentTotalGenerated: number): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({
        used_today: currentUsedToday + 1,
        total_generated: currentTotalGenerated + 1,
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`记录使用失败: ${error.message}`);
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 获取当前设备指纹
   */
  async getCurrentFingerprint(): Promise<string> {
    return this.deviceFingerprint.generateFingerprint();
  }

  /**
   * 根据认证提供商获取每日配额
   */
  private getQuotaByProvider(provider: AuthProvider): number {
    switch (provider) {
      case 'github':
        return 50;
      case 'google':
        return 50;
      case 'device':
      default:
        return 10;
    }
  }

  /**
   * 升级用户配额（当匿名用户登录后）
   */
  async upgradeUserQuota(userId: string, provider: AuthProvider): Promise<User> {
    const newQuota = this.getQuotaByProvider(provider);
    return this.update(userId, { daily_quota: newQuota });
  }

  /**
   * 合并用户数据（将匿名用户数据合并到已登录用户）
   * 用于匿名用户登录后的数据迁移
   */
  async mergeUsers(sourceUserId: string, targetUserId: string): Promise<void> {
    // 1. 更新 generations 表的 user_id
    const { error: genError } = await this.supabase
      .from('generations')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId);

    if (genError) {
      throw new Error(`迁移生成记录失败: ${genError.message}`);
    }

    // 2. 更新 image_feedback 表的 user_id
    const { error: feedbackError } = await this.supabase
      .from('image_feedback')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId);

    if (feedbackError) {
      throw new Error(`迁移反馈记录失败: ${feedbackError.message}`);
    }

    // 3. 合并统计数据
    const sourceUser = await this.findById(sourceUserId);
    const targetUser = await this.findById(targetUserId);

    if (sourceUser && targetUser) {
      await this.update(targetUserId, {
        total_generated: targetUser.total_generated + sourceUser.total_generated,
      });
    }

    // 4. 删除源用户（级联删除会处理 auth_accounts）
    const { error: deleteError } = await this.supabase
      .from('users')
      .delete()
      .eq('id', sourceUserId);

    if (deleteError) {
      throw new Error(`删除源用户失败: ${deleteError.message}`);
    }
  }

  /**
   * 合并 OAuth 用户（将源用户的认证方式和数据迁移到目标用户）
   * 用于绑定已有独立账号的场景
   */
  async mergeOAuthUsers(sourceUserId: string, targetUserId: string): Promise<void> {
    // 1. 迁移 auth_accounts（除了 device 类型）
    const { error: authError } = await this.supabase
      .from('auth_accounts')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .neq('provider', 'device');

    if (authError) {
      throw new Error(`迁移认证账号失败: ${authError.message}`);
    }

    // 2. 更新 generations 表的 user_id
    const { error: genError } = await this.supabase
      .from('generations')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId);

    if (genError) {
      throw new Error(`迁移生成记录失败: ${genError.message}`);
    }

    // 3. 更新 image_feedback 表的 user_id
    const { error: feedbackError } = await this.supabase
      .from('image_feedback')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId);

    if (feedbackError) {
      throw new Error(`迁移反馈记录失败: ${feedbackError.message}`);
    }

    // 4. 合并统计数据
    const sourceUser = await this.findById(sourceUserId);
    const targetUser = await this.findById(targetUserId);

    if (sourceUser && targetUser) {
      await this.update(targetUserId, {
        total_generated: targetUser.total_generated + sourceUser.total_generated,
      });
    }

    // 5. 删除源用户
    const { error: deleteError } = await this.supabase
      .from('users')
      .delete()
      .eq('id', sourceUserId);

    if (deleteError) {
      throw new Error(`删除源用户失败: ${deleteError.message}`);
    }
  }
}
