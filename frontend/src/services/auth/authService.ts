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

    // 检查是否已有对应的应用用户
    let appUser = await this.userRepository.findByAuthProvider(provider, providerId);

    if (appUser) {
      // 用户已存在，检查是否需要合并匿名数据
      await this.mergeAnonymousDataIfNeeded(appUser.id);
      return appUser;
    }

    // 创建新的应用用户
    appUser = await this.createAppUserFromSupabase(supabaseUser);

    // 合并匿名数据
    await this.mergeAnonymousDataIfNeeded(appUser.id);

    return appUser;
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
        console.log('🔄 合并匿名用户数据:', anonymousUserId, '->', targetUserId);
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
