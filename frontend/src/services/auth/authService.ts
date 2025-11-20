/**
 * 认证服务
 * 处理 OAuth 登录、登出、会话管理
 */

import { supabase } from '../../config/supabase';
import { UserRepository } from '../../repositories/userRepository';
import type { User as AppUser, AuthProvider } from '../../types/database';
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js';

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  supabaseUser: SupabaseUser | null;
  appUser: AppUser | null;
  session: Session | null;
}

// 登录选项
export interface LoginOptions {
  redirectTo?: string;
  scopes?: string;
}

export class AuthService {
  private static instance: AuthService;
  private userRepository: UserRepository;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ============================================
  // 登录方法
  // ============================================

  /**
   * GitHub 登录
   */
  async loginWithGitHub(options?: LoginOptions): Promise<void> {
    // 保存当前匿名用户 ID，用于登录后合并数据
    const anonymousUserId = await this.getCurrentAnonymousUserId();
    if (anonymousUserId) {
      localStorage.setItem('prism_anonymous_user_id', anonymousUserId);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'read:user user:email',
      },
    });

    if (error) {
      throw new Error(`GitHub 登录失败: ${error.message}`);
    }
  }

  /**
   * Google 登录（预留）
   */
  async loginWithGoogle(options?: LoginOptions): Promise<void> {
    const anonymousUserId = await this.getCurrentAnonymousUserId();
    if (anonymousUserId) {
      localStorage.setItem('prism_anonymous_user_id', anonymousUserId);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'email profile',
      },
    });

    if (error) {
      throw new Error(`Google 登录失败: ${error.message}`);
    }
  }

  // ============================================
  // 绑定方法（将新认证方式绑定到当前用户）
  // ============================================

  /**
   * 绑定 GitHub 账号到当前用户
   */
  async bindWithGitHub(currentUserId: string, options?: LoginOptions): Promise<void> {
    // 保存绑定信息，用于回调时识别这是绑定操作
    localStorage.setItem('prism_bind_user_id', currentUserId);
    localStorage.setItem('prism_bind_provider', 'github');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'read:user user:email',
      },
    });

    if (error) {
      localStorage.removeItem('prism_bind_user_id');
      localStorage.removeItem('prism_bind_provider');
      throw new Error(`绑定 GitHub 失败: ${error.message}`);
    }
  }

  /**
   * 绑定 Google 账号到当前用户
   */
  async bindWithGoogle(currentUserId: string, options?: LoginOptions): Promise<void> {
    // 保存绑定信息
    localStorage.setItem('prism_bind_user_id', currentUserId);
    localStorage.setItem('prism_bind_provider', 'google');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        scopes: options?.scopes || 'email profile',
      },
    });

    if (error) {
      localStorage.removeItem('prism_bind_user_id');
      localStorage.removeItem('prism_bind_provider');
      throw new Error(`绑定 Google 失败: ${error.message}`);
    }
  }

  // ============================================
  // 登出方法
  // ============================================

  /**
   * 登出
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`登出失败: ${error.message}`);
    }
  }

  // ============================================
  // 会话管理
  // ============================================

  /**
   * 获取当前会话
   */
  async getSession(): Promise<Session | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('获取会话失败:', error);
      return null;
    }
    return session;
  }

  /**
   * 获取当前 Supabase 用户
   */
  async getSupabaseUser(): Promise<SupabaseUser | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('获取用户失败:', error);
      return null;
    }
    return user;
  }

  /**
   * 获取当前应用用户（从 users 表）
   */
  async getAppUser(): Promise<AppUser | null> {
    const supabaseUser = await this.getSupabaseUser();
    if (!supabaseUser) {
      // 未登录，尝试获取匿名用户
      return this.getOrCreateAnonymousUser();
    }

    // 根据 Supabase 用户查找应用用户
    const provider = this.getProviderFromUser(supabaseUser);
    const providerId = supabaseUser.id;

    let appUser = await this.userRepository.findByAuthProvider(provider, providerId);

    // 如果不存在，创建新用户
    if (!appUser) {
      appUser = await this.createAppUserFromSupabase(supabaseUser);
    }

    return appUser;
  }

  /**
   * 监听认证状态变化
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // ============================================
  // 账户合并
  // ============================================

  /**
   * 处理 OAuth 回调后的账户合并
   * 在回调页面调用此方法
   */
  async handleAuthCallback(): Promise<AppUser | null> {
    const supabaseUser = await this.getSupabaseUser();
    if (!supabaseUser) {
      return null;
    }

    const provider = this.getProviderFromUser(supabaseUser);
    const providerId = supabaseUser.id;
    const email = supabaseUser.email;

    // 检查是否是绑定操作
    const bindUserId = localStorage.getItem('prism_bind_user_id');
    const bindProvider = localStorage.getItem('prism_bind_provider');

    if (bindUserId && bindProvider) {
      // 这是绑定操作，将新认证方式绑定到指定用户
      return this.handleBindCallback(supabaseUser, bindUserId);
    }

    // 以下是登录操作的逻辑

    // 1. 检查该 OAuth 提供商是否已有用户
    let appUser = await this.userRepository.findByAuthProvider(provider, providerId);

    if (appUser) {
      // 用户已存在，检查是否需要合并匿名数据
      await this.mergeAnonymousDataIfNeeded(appUser.id);
      return appUser;
    }

    // 2. 检查邮箱是否已有用户（邮箱关联）
    if (email) {
      const existingUserByEmail = await this.userRepository.findByEmail(email);

      if (existingUserByEmail) {
        // 邮箱已存在，将新的认证方式绑定到现有用户
        const metadata = supabaseUser.user_metadata || {};
        await this.userRepository.linkAuthAccount(
          existingUserByEmail.id,
          provider,
          providerId,
          {
            providerEmail: email,
            providerData: metadata,
          }
        );

        // 如果现有用户配额较低，升级配额
        if (existingUserByEmail.daily_quota < 50 && (provider === 'github' || provider === 'google')) {
          await this.userRepository.upgradeUserQuota(existingUserByEmail.id, provider);
        }

        // 合并匿名数据
        await this.mergeAnonymousDataIfNeeded(existingUserByEmail.id);

        // 返回更新后的用户
        return await this.userRepository.findById(existingUserByEmail.id);
      }
    }

    // 3. 创建新用户
    appUser = await this.createAppUserFromSupabase(supabaseUser);

    // 合并匿名数据
    await this.mergeAnonymousDataIfNeeded(appUser.id);

    return appUser;
  }

  /**
   * 处理绑定回调
   * 将新的认证方式绑定到指定用户
   * 如果该认证方式已有独立账号，则自动合并
   */
  private async handleBindCallback(supabaseUser: SupabaseUser, targetUserId: string): Promise<AppUser | null> {
    const provider = this.getProviderFromUser(supabaseUser);
    const providerId = supabaseUser.id;
    const email = supabaseUser.email;
    const metadata = supabaseUser.user_metadata || {};

    try {
      // 检查该认证方式是否已被其他用户使用
      const existingUser = await this.userRepository.findByAuthProvider(provider, providerId);

      if (existingUser && existingUser.id !== targetUserId) {
        // 该 OAuth 账号已有独立用户，执行合并操作
        // 合并用户数据和认证信息
        await this.userRepository.mergeOAuthUsers(existingUser.id, targetUserId);

        // 清除绑定标识
        localStorage.removeItem('prism_bind_user_id');
        localStorage.removeItem('prism_bind_provider');

        // 返回更新后的目标用户
        return await this.userRepository.findById(targetUserId);
      }

      // 如果已经绑定到当前用户，直接返回
      if (existingUser && existingUser.id === targetUserId) {
        localStorage.removeItem('prism_bind_user_id');
        localStorage.removeItem('prism_bind_provider');
        return existingUser;
      }

      // 绑定新的认证方式（该 OAuth 之前从未使用过）
      await this.userRepository.linkAuthAccount(
        targetUserId,
        provider,
        providerId,
        {
          providerEmail: email || undefined,
          providerData: metadata,
        }
      );

      // 如果用户配额较低，升级配额
      const targetUser = await this.userRepository.findById(targetUserId);
      if (targetUser && targetUser.daily_quota < 50 && (provider === 'github' || provider === 'google')) {
        await this.userRepository.upgradeUserQuota(targetUserId, provider);
      }

      // 清除绑定标识
      localStorage.removeItem('prism_bind_user_id');
      localStorage.removeItem('prism_bind_provider');

      // 返回更新后的用户
      return await this.userRepository.findById(targetUserId);
    } catch (error) {
      console.error('绑定账号失败:', error);
      // 清除绑定标识
      localStorage.removeItem('prism_bind_user_id');
      localStorage.removeItem('prism_bind_provider');
      // 返回目标用户
      return await this.userRepository.findById(targetUserId);
    }
  }

  /**
   * 合并匿名用户数据到已登录用户
   */
  private async mergeAnonymousDataIfNeeded(targetUserId: string): Promise<void> {
    const anonymousUserId = localStorage.getItem('prism_anonymous_user_id');
    if (!anonymousUserId) {
      return;
    }

    try {
      // 检查匿名用户是否存在
      const anonymousUser = await this.userRepository.findById(anonymousUserId);
      if (anonymousUser && anonymousUser.id !== targetUserId) {
        await this.userRepository.mergeUsers(anonymousUserId, targetUserId);
      }
    } catch (error) {
      console.error('合并匿名数据失败:', error);
    } finally {
      // 清除匿名用户 ID
      localStorage.removeItem('prism_anonymous_user_id');
    }
  }

  // ============================================
  // 匿名用户管理
  // ============================================

  /**
   * 获取或创建匿名用户
   */
  async getOrCreateAnonymousUser(): Promise<AppUser | null> {
    try {
      const fingerprint = await this.userRepository.getCurrentFingerprint();

      // 查找现有用户
      let user = await this.userRepository.findByFingerprint(fingerprint);

      if (!user) {
        // 创建新的匿名用户
        user = await this.userRepository.create('device', fingerprint);
      }

      return user;
    } catch (error) {
      console.error('获取匿名用户失败:', error);
      return null;
    }
  }

  /**
   * 获取当前匿名用户 ID
   */
  private async getCurrentAnonymousUserId(): Promise<string | null> {
    try {
      const fingerprint = await this.userRepository.getCurrentFingerprint();
      const user = await this.userRepository.findByFingerprint(fingerprint);
      return user?.id || null;
    } catch {
      return null;
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 从 Supabase 用户创建应用用户
   */
  private async createAppUserFromSupabase(supabaseUser: SupabaseUser): Promise<AppUser> {
    const provider = this.getProviderFromUser(supabaseUser);
    const metadata = supabaseUser.user_metadata || {};

    return this.userRepository.create(provider, supabaseUser.id, {
      displayName: metadata.full_name || metadata.name || metadata.user_name || undefined,
      email: supabaseUser.email || undefined,
      avatarUrl: metadata.avatar_url || undefined,
      providerEmail: supabaseUser.email || undefined,
      providerData: metadata,
    });
  }

  /**
   * 从 Supabase 用户获取认证提供商类型
   */
  private getProviderFromUser(user: SupabaseUser): AuthProvider {
    const provider = user.app_metadata?.provider;
    switch (provider) {
      case 'github':
        return 'github';
      case 'google':
        return 'google';
      default:
        return 'device';
    }
  }

  /**
   * 检查用户是否已登录（OAuth）
   */
  async isLoggedIn(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * 获取用户类型
   */
  async getUserType(): Promise<'anonymous' | 'github' | 'google'> {
    const session = await this.getSession();
    if (!session) {
      return 'anonymous';
    }

    const user = session.user;
    const provider = user.app_metadata?.provider;

    if (provider === 'github') return 'github';
    if (provider === 'google') return 'google';
    return 'anonymous';
  }
}
