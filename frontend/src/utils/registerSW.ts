/**
 * Service Worker 注册工具
 * 【暂时禁用】由于缓存问题导致页面空白，暂时禁用PWA功能
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // 【紧急修复】完全禁用Service Worker并清理旧缓存
  console.log('[PWA] Service Worker已禁用，正在清理旧缓存...');

  // 卸载所有Service Worker
  await unregisterServiceWorker();

  // 清除所有缓存
  await clearAllCaches();

  console.log('[PWA] 清理完成，Service Worker已禁用');
  return null;
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
