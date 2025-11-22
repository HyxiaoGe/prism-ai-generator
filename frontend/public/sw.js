/**
 * Service Worker - PWA离线缓存
 * 提供离线访问能力和静态资源缓存
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `prism-ai-${CACHE_VERSION}`;

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 需要缓存的API路径前缀
const API_CACHE_PATTERNS = [
  '/api/',
  '/.netlify/functions/',
];

// 图片资源缓存策略：缓存优先
const IMAGE_CACHE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  /replicate\.delivery/, // Replicate CDN
  /cloudflare/, // Cloudflare R2
];

/**
 * 安装事件 - 缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 缓存静态资源');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] 安装完成');
      // 强制激活新的Service Worker
      return self.skipWaiting();
    })
  );
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] 激活完成');
      // 立即控制所有页面
      return self.clients.claim();
    })
  );
});

/**
 * 判断是否为图片请求
 */
function isImageRequest(url) {
  return IMAGE_CACHE_PATTERNS.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    return url.includes(pattern);
  });
}

/**
 * 判断是否为API请求
 */
function isAPIRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => url.includes(pattern));
}

/**
 * 网络优先策略（适用于API请求）
 * 先尝试网络请求，失败则返回缓存
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // 尝试网络请求
    const response = await fetch(request);

    // 如果成功，更新缓存
    if (response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // 网络失败，尝试返回缓存
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] 网络失败，返回缓存:', request.url);
      return cached;
    }

    // 没有缓存，返回离线页面
    throw error;
  }
}

/**
 * 缓存优先策略（适用于图片等静态资源）
 * 先尝试缓存，不存在则网络请求并缓存
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  // 先尝试从缓存获取
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  // 缓存不存在，发起网络请求
  try {
    const response = await fetch(request);

    // 如果成功，添加到缓存
    if (response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] 网络请求失败:', request.url);
    throw error;
  }
}

/**
 * 仅网络策略（不缓存）
 * 适用于动态内容和认证请求
 */
async function networkOnly(request) {
  return fetch(request);
}

/**
 * Fetch事件 - 请求拦截
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // 跳过非HTTP/HTTPS请求
  if (!url.startsWith('http')) {
    return;
  }

  // 跳过Chrome扩展请求
  if (url.startsWith('chrome-extension://')) {
    return;
  }

  // 根据请求类型选择缓存策略
  if (isImageRequest(url)) {
    // 图片：缓存优先
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(url)) {
    // API：网络优先
    event.respondWith(networkFirst(request));
  } else if (url.includes('/auth/') || url.includes('/oauth')) {
    // 认证相关：仅网络
    event.respondWith(networkOnly(request));
  } else {
    // 其他静态资源：缓存优先
    event.respondWith(cacheFirst(request));
  }
});

/**
 * 消息事件 - 处理来自页面的消息
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] 缓存已清除');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[SW] Service Worker加载完成');
