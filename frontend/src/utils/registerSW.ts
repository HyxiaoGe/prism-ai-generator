/**
 * Service Worker 注册工具
 * 在生产环境自动注册PWA Service Worker
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // 只在生产环境且浏览器支持Service Worker时注册
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      console.log('[PWA] 正在注册Service Worker...');

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker注册成功:', registration.scope);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本可用
              console.log('[PWA] 检测到新版本，正在更新...');

              // 可以在这里显示更新提示
              if (confirm('检测到新版本，是否立即更新？')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      // 监听控制权变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker控制权已更新');
      });

      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker注册失败:', error);
      return null;
    }
  } else {
    if (!import.meta.env.PROD) {
      console.log('[PWA] 开发环境，跳过Service Worker注册');
    } else {
      console.warn('[PWA] 浏览器不支持Service Worker');
    }
    return null;
  }
}

/**
 * 注销Service Worker（调试用）
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.log('[PWA] Service Worker已注销');
      return true;
    } catch (error) {
      console.error('[PWA] 注销Service Worker失败:', error);
      return false;
    }
  }
  return false;
}

/**
 * 清除所有缓存（调试用）
 */
export async function clearAllCaches(): Promise<boolean> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[PWA] 所有缓存已清除');
      return true;
    } catch (error) {
      console.error('[PWA] 清除缓存失败:', error);
      return false;
    }
  }
  return false;
}
