/**
 * 认证状态管理
 * 使用 Zustand 管理全局认证状态
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AuthService } from '../services/auth';
import type { User as AppUser } from '../types/database';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// 用户类型
export type UserType = 'anonymous' | 'github' | 'google';

// 认证状态
interface AuthState {
  // 状态
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  supabaseUser: SupabaseUser | null;
  appUser: AppUser | null;
  session: Session | null;
  userType: UserType;

  // Actions
  initialize: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  bindWithGitHub: () => Promise<void>;
  bindWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  handleAuthCallback: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      isLoading: true,
      isLoggingOut: false,
      supabaseUser: null,
      appUser: null,
      session: null,
      userType: 'anonymous',

      // 初始化认证状态
      initialize: async () => {
        set({ isLoading: true }, false, 'initialize:start');

        try {
          const authService = AuthService.getInstance();

          // 获取当前会话
          const session = await authService.getSession();
          const supabaseUser = session?.user || null;

          // 获取应用用户
          const appUser = await authService.getAppUser();

          // 确定用户类型
          let userType: UserType = 'anonymous';
          if (supabaseUser) {
            const provider = supabaseUser.app_metadata?.provider;
            if (provider === 'github') userType = 'github';
            else if (provider === 'google') userType = 'google';
          }

          set({
            isAuthenticated: supabaseUser !== null,
            supabaseUser,
            appUser,
            session,
            userType,
            isLoading: false,
          }, false, 'initialize:complete');

          // 设置认证状态变化监听
          authService.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              await get().refreshUser();
            } else if (event === 'SIGNED_OUT') {
              // 登出后重置为匿名用户
              const anonymousUser = await authService.getOrCreateAnonymousUser();
              set({
                isAuthenticated: false,
                supabaseUser: null,
                appUser: anonymousUser,
                session: null,
                userType: 'anonymous',
              }, false, 'signedOut');
            }
          });

        } catch (error) {
          console.error('初始化认证失败:', error);
          set({ isLoading: false }, false, 'initialize:error');
        }
      },

      // GitHub 登录
      loginWithGitHub: async () => {
        try {
          const authService = AuthService.getInstance();
          await authService.loginWithGitHub();
          // 登录后会重定向，不需要在这里更新状态
        } catch (error) {
          console.error('GitHub 登录失败:', error);
          throw error;
        }
      },

      // Google 登录
      loginWithGoogle: async () => {
        try {
          const authService = AuthService.getInstance();
          await authService.loginWithGoogle();
        } catch (error) {
          console.error('Google 登录失败:', error);
          throw error;
        }
      },

      // 绑定 GitHub 账号到当前用户
      bindWithGitHub: async () => {
        const { appUser } = get();
        if (!appUser) {
          throw new Error('当前用户不存在');
        }

        try {
          const authService = AuthService.getInstance();
          await authService.bindWithGitHub(appUser.id);
          // 绑定后会重定向，不需要在这里更新状态
        } catch (error) {
          console.error('绑定 GitHub 失败:', error);
          throw error;
        }
      },

      // 绑定 Google 账号到当前用户
      bindWithGoogle: async () => {
        const { appUser } = get();
        if (!appUser) {
          throw new Error('当前用户不存在');
        }

        try {
          const authService = AuthService.getInstance();
          await authService.bindWithGoogle(appUser.id);
        } catch (error) {
          console.error('绑定 Google 失败:', error);
          throw error;
        }
      },

      // 登出（乐观更新）
      logout: async () => {
        // 1. 立即更新 UI - 乐观更新
        set({
          isLoggingOut: true,
          isAuthenticated: false,
          supabaseUser: null,
          session: null,
          userType: 'anonymous',
        }, false, 'logout:optimistic');

        try {
          const authService = AuthService.getInstance();

          // 2. 异步调用登出 API
          await authService.logout();

          // 3. 异步获取匿名用户（不阻塞 UI）
          const anonymousUser = await authService.getOrCreateAnonymousUser();

          set({
            appUser: anonymousUser,
            isLoggingOut: false,
          }, false, 'logout:complete');

        } catch (error) {
          console.error('登出失败:', error);
          // 即使出错也完成登出状态
          set({ isLoggingOut: false }, false, 'logout:error');
        }
      },

      // 处理 OAuth 回调
      handleAuthCallback: async () => {
        set({ isLoading: true }, false, 'handleAuthCallback:start');

        try {
          const authService = AuthService.getInstance();

          // 处理回调并获取/创建应用用户
          const appUser = await authService.handleAuthCallback();

          // 获取当前会话
          const session = await authService.getSession();
          const supabaseUser = session?.user || null;

          // 确定用户类型
          let userType: UserType = 'anonymous';
          if (supabaseUser) {
            const provider = supabaseUser.app_metadata?.provider;
            if (provider === 'github') userType = 'github';
            else if (provider === 'google') userType = 'google';
          }

          set({
            isAuthenticated: supabaseUser !== null,
            supabaseUser,
            appUser,
            session,
            userType,
            isLoading: false,
          }, false, 'handleAuthCallback:complete');

        } catch (error) {
          console.error('处理认证回调失败:', error);
          set({ isLoading: false }, false, 'handleAuthCallback:error');
          throw error;
        }
      },

      // 刷新用户信息
      refreshUser: async () => {
        try {
          const authService = AuthService.getInstance();

          const session = await authService.getSession();
          const supabaseUser = session?.user || null;
          const appUser = await authService.getAppUser();

          let userType: UserType = 'anonymous';
          if (supabaseUser) {
            const provider = supabaseUser.app_metadata?.provider;
            if (provider === 'github') userType = 'github';
            else if (provider === 'google') userType = 'google';
          }

          set({
            isAuthenticated: supabaseUser !== null,
            supabaseUser,
            appUser,
            session,
            userType,
          }, false, 'refreshUser');

        } catch (error) {
          console.error('刷新用户信息失败:', error);
        }
      },

      // 设置加载状态
      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },
    }),
    {
      name: 'auth-store',
    }
  )
);
