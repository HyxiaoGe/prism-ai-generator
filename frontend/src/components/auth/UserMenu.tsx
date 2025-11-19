/**
 * 用户菜单组件
 * 显示登录按钮或用户头像下拉菜单
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../store/authStore';
import { AccountSettings } from './AccountSettings';
import { UserRepository } from '../../repositories/userRepository';
import type { AuthAccount } from '../../types/database';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginOptions, setShowLoginOptions] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isAuthenticated,
    isLoading,
    isLoggingOut,
    appUser,
    userType,
    loginWithGitHub,
    loginWithGoogle,
    logout,
  } = useAuthStore();

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowLoginOptions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 当 avatarUrl 变化时重置加载状态
  const avatarUrl = appUser?.avatar_url;
  useEffect(() => {
    setImageLoaded(false);
  }, [avatarUrl]);

  // 加载已绑定的认证账号
  useEffect(() => {
    const loadAuthAccounts = async () => {
      if (!appUser) {
        setAuthAccounts([]);
        return;
      }

      try {
        const userRepo = UserRepository.getInstance();
        const accounts = await userRepo.findAuthAccounts(appUser.id);
        setAuthAccounts(accounts.filter(acc => acc.provider !== 'device'));
      } catch (error) {
        console.error('加载认证账号失败:', error);
      }
    };

    loadAuthAccounts();
  }, [appUser]);

  // 处理 GitHub 登录
  const handleGitHubLogin = async () => {
    try {
      setIsLoggingIn(true);
      setShowLoginOptions(false);
      await loginWithGitHub();
    } catch (error) {
      console.error('GitHub 登录失败:', error);
      setIsLoggingIn(false);
    }
  };

  // 处理 Google 登录
  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setShowLoginOptions(false);
      await loginWithGoogle();
    } catch (error) {
      console.error('Google 登录失败:', error);
      setIsLoggingIn(false);
    }
  };

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  // 加载中
  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  // 未登录 - 显示登录按钮
  if (!isAuthenticated) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => !isLoggingIn && setShowLoginOptions(!showLoginOptions)}
          disabled={isLoggingIn}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg transition-all ${
            isLoggingIn ? 'opacity-70 cursor-wait' : 'hover:from-purple-700 hover:to-blue-700'
          }`}
        >
          {isLoggingIn ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              登录中...
            </>
          ) : (
            '登录'
          )}
        </button>

        {/* 登录选项下拉 */}
        {showLoginOptions && !isLoggingIn && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub 登录
            </button>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google 登录
            </button>
          </div>
        )}
      </div>
    );
  }

  // 已登录 - 显示用户头像和下拉菜单
  const displayName = appUser?.display_name || appUser?.email || '用户';

  return (
    <div className="relative" ref={menuRef}>
      {/* 头像按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        {avatarUrl ? (
          <div className="relative w-8 h-8">
            {/* 图片未加载时显示渐变占位符 */}
            {!imageLoaded && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <img
              src={avatarUrl}
              alt={displayName}
              className={`w-8 h-8 rounded-full transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* 用户信息 */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </p>
                {appUser?.email && (
                  <p className="text-xs text-gray-500 truncate">
                    {appUser.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 已绑定账号标签 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              {authAccounts.some(acc => acc.provider === 'github') && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </span>
              )}
              {authAccounts.some(acc => acc.provider === 'google') && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  <svg className="w-3 h-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </span>
              )}
              {authAccounts.length === 0 && (
                <span className="text-xs text-gray-400">加载中...</span>
              )}
            </div>
          </div>

          {/* 使用情况 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-xs text-gray-500">
              今日已用: {appUser?.used_today || 0} / {appUser?.daily_quota || 10}
            </div>
            <div className="text-xs text-gray-500">
              总生成数: {appUser?.total_generated || 0}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="px-2 py-1">
            <button
              onClick={() => {
                setShowAccountSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              账号设置
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`w-full px-3 py-2 text-left text-sm rounded transition-colors ${
                isLoggingOut
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              {isLoggingOut ? '退出中...' : '退出登录'}
            </button>
          </div>
        </div>
      )}

      {/* 账号设置模态框 - 使用 Portal 渲染到 body 以确保居中显示 */}
      {showAccountSettings && createPortal(
        <AccountSettings onClose={() => setShowAccountSettings(false)} />,
        document.body
      )}
    </div>
  );
}
