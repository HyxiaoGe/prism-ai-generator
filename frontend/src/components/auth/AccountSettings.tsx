/**
 * 账号设置组件
 * 显示用户信息、已绑定账号、绑定/解绑功能
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { UserRepository } from '../../repositories/userRepository';
import type { AuthAccount } from '../../types/database';

interface AccountSettingsProps {
  onClose: () => void;
}

export function AccountSettings({ onClose }: AccountSettingsProps) {
  const {
    appUser,
    userType,
    bindWithGitHub,
    bindWithGoogle,
    refreshUser,
  } = useAuthStore();

  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载已绑定的账号
  useEffect(() => {
    const loadAuthAccounts = async () => {
      if (!appUser) return;

      try {
        setIsLoading(true);
        const userRepo = UserRepository.getInstance();
        const accounts = await userRepo.findAuthAccounts(appUser.id);
        setAuthAccounts(accounts);
      } catch (err) {
        console.error('加载认证账号失败:', err);
        setError('加载账号信息失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthAccounts();
  }, [appUser]);

  // 检查是否已绑定某个提供商
  const isBound = (provider: string) => {
    return authAccounts.some(acc => acc.provider === provider);
  };

  // 绑定 GitHub
  const handleBindGitHub = async () => {
    if (isBound('github')) return;

    try {
      setIsBinding(true);
      setError(null);
      await bindWithGitHub();
      // 绑定后会重定向，不需要在这里处理
    } catch (err) {
      console.error('绑定 GitHub 失败:', err);
      setError('绑定 GitHub 失败');
      setIsBinding(false);
    }
  };

  // 绑定 Google
  const handleBindGoogle = async () => {
    if (isBound('google')) return;

    try {
      setIsBinding(true);
      setError(null);
      await bindWithGoogle();
      // 绑定后会重定向，不需要在这里处理
    } catch (err) {
      console.error('绑定 Google 失败:', err);
      setError('绑定 Google 失败');
      setIsBinding(false);
    }
  };

  // 解绑账号
  const handleUnbind = async (accountId: string, provider: string) => {
    // 检查是否是最后一个登录方式
    const oauthAccounts = authAccounts.filter(acc => acc.provider !== 'device');
    if (oauthAccounts.length <= 1) {
      setError('至少需要保留一个登录方式');
      return;
    }

    try {
      setError(null);
      const userRepo = UserRepository.getInstance();
      await userRepo.unlinkAuthAccount(accountId);

      // 刷新账号列表
      const accounts = await userRepo.findAuthAccounts(appUser!.id);
      setAuthAccounts(accounts);
    } catch (err) {
      console.error('解绑账号失败:', err);
      setError('解绑账号失败');
    }
  };

  // 获取提供商显示信息
  const getProviderInfo = (provider: string) => {
    switch (provider) {
      case 'github':
        return {
          name: 'GitHub',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          ),
          color: 'bg-gray-900 text-white',
        };
      case 'google':
        return {
          name: 'Google',
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          ),
          color: 'bg-white border border-gray-300 text-gray-700',
        };
      default:
        return {
          name: provider,
          icon: null,
          color: 'bg-gray-100 text-gray-700',
        };
    }
  };

  const displayName = appUser?.display_name || appUser?.email || '用户';
  const avatarUrl = appUser?.avatar_url;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">账号设置</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 用户信息 */}
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-2xl font-medium">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{displayName}</h3>
              {appUser?.email && (
                <p className="text-sm text-gray-500">{appUser.email}</p>
              )}
            </div>
          </div>

          {/* 使用统计 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">使用统计</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {appUser?.used_today || 0}/{appUser?.daily_quota || 10}
                </p>
                <p className="text-xs text-gray-500">今日已用/配额</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {appUser?.total_generated || 0}
                </p>
                <p className="text-xs text-gray-500">总生成数</p>
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 已绑定账号 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">已绑定账号</h4>
            {isLoading ? (
              <div className="text-sm text-gray-500">加载中...</div>
            ) : (
              <div className="space-y-2">
                {authAccounts
                  .filter(acc => acc.provider !== 'device')
                  .map(account => {
                    const info = getProviderInfo(account.provider);
                    const oauthCount = authAccounts.filter(acc => acc.provider !== 'device').length;

                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {info.icon}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{info.name}</p>
                            {account.provider_email && (
                              <p className="text-xs text-gray-500">{account.provider_email}</p>
                            )}
                          </div>
                        </div>
                        {oauthCount > 1 && (
                          <button
                            onClick={() => handleUnbind(account.id, account.provider)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            解绑
                          </button>
                        )}
                      </div>
                    );
                  })}

                {authAccounts.filter(acc => acc.provider !== 'device').length === 0 && (
                  <p className="text-sm text-gray-500">暂无绑定的登录方式</p>
                )}
              </div>
            )}
          </div>

          {/* 绑定新账号 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">绑定新账号</h4>
            {/* 警告提示 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-amber-700">
                <strong>注意：</strong>绑定操作不可逆。绑定后无法解绑，只能换绑到其他同类型账号。如果目标账号已有独立用户，将自动合并数据。
              </p>
            </div>
            <div className="space-y-2">
              {/* GitHub */}
              <button
                onClick={handleBindGitHub}
                disabled={isBound('github') || isBinding}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                  isBound('github')
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {isBound('github') ? '已绑定 GitHub' : '绑定 GitHub'}
              </button>

              {/* Google */}
              <button
                onClick={handleBindGoogle}
                disabled={isBound('google') || isBinding}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  isBound('google')
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isBound('google') ? '已绑定 Google' : '绑定 Google'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
