/**
 * 网络请求重试工具
 * 提供指数退避重试机制
 */

export interface RetryOptions {
  maxRetries?: number; // 最大重试次数，默认 3
  initialDelay?: number; // 初始延迟（毫秒），默认 1000
  maxDelay?: number; // 最大延迟（毫秒），默认 10000
  backoffMultiplier?: number; // 退避倍数，默认 2
  shouldRetry?: (error: any) => boolean; // 判断是否应该重试
  onRetry?: (error: any, attempt: number) => void; // 重试回调
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // 默认只在网络错误或 5xx 错误时重试
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true; // 网络错误
    }
    if (error.status >= 500 && error.status < 600) {
      return true; // 服务器错误
    }
    if (error.status === 429) {
      return true; // 请求过于频繁
    }
    return false;
  },
  onRetry: () => {}
};

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算下一次重试的延迟时间（指数退避）
 */
function getRetryDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  // 添加随机抖动，避免雷鸣羊群效应
  const jitter = exponentialDelay * 0.1 * Math.random();
  return Math.min(exponentialDelay + jitter, options.maxDelay);
}

/**
 * 执行带重试的异步函数
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试，或者不应该重试，直接抛出错误
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // 计算延迟时间
      const delayMs = getRetryDelay(attempt, opts);

      console.log(`⚠️ 请求失败，${delayMs}ms 后重试 (${attempt + 1}/${opts.maxRetries})`, error);

      // 调用重试回调
      opts.onRetry(error, attempt + 1);

      // 等待后重试
      await delay(delayMs);
    }
  }

  // 理论上不会到这里，但为了类型安全
  throw lastError;
}

/**
 * Fetch 请求的重试包装
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryAsync(
    async () => {
      const response = await fetch(url, options);

      // 如果响应不成功，抛出错误以触发重试
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    },
    retryOptions
  );
}
