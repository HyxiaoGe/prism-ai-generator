// 无登录用户限流系统
// 基于设备指纹识别和本地存储的用量追踪

interface DeviceFingerprint {
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  hash: string;
}

interface UsageRecord {
  count: number;
  lastUsed: Date;
  resetDate: string; // YYYY-MM-DD 格式
}

interface UsageLimits {
  daily: number;
  hourly: number;
  perSession: number;
}

export class UsageTracker {
  private static instance: UsageTracker;
  private fingerprint: DeviceFingerprint;
  private limits: UsageLimits = {
    daily: 20,     // 每日20次生成
    hourly: 10,    // 每小时10次生成  
    perSession: 5  // 每会话5次生成
  };

  private constructor() {
    this.fingerprint = this.generateFingerprint();
  }

  public static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * 生成设备指纹
   */
  private generateFingerprint(): DeviceFingerprint {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }

    const fingerprint = {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      hash: ''
    };

    // 生成简单哈希
    const dataString = Object.values(fingerprint).join('|');
    fingerprint.hash = this.simpleHash(dataString);

    return fingerprint;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取存储键
   */
  private getStorageKey(type: 'daily' | 'hourly' | 'session'): string {
    return `usage_${type}_${this.fingerprint.hash}`;
  }

  /**
   * 获取当前使用量
   */
  private getCurrentUsage(type: 'daily' | 'hourly' | 'session'): UsageRecord {
    const key = this.getStorageKey(type);
    const stored = localStorage.getItem(key);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    
    if (!stored) {
      return {
        count: 0,
        lastUsed: now,
        resetDate: today
      };
    }

    try {
      const record: UsageRecord = JSON.parse(stored);
      
      // 检查是否需要重置计数
      let shouldReset = false;
      
      switch (type) {
        case 'daily':
          shouldReset = record.resetDate !== today;
          break;
        case 'hourly':
          const lastHour = new Date(record.lastUsed).getHours();
          shouldReset = currentHour !== lastHour || record.resetDate !== today;
          break;
        case 'session':
          // 会话计数在页面刷新时重置
          shouldReset = !sessionStorage.getItem(key);
          break;
      }

      if (shouldReset) {
        return {
          count: 0,
          lastUsed: now,
          resetDate: today
        };
      }

      return {
        ...record,
        lastUsed: new Date(record.lastUsed)
      };
    } catch (error) {
      console.error('解析使用记录失败:', error);
      return {
        count: 0,
        lastUsed: now,
        resetDate: today
      };
    }
  }

  /**
   * 保存使用记录
   */
  private saveUsageRecord(type: 'daily' | 'hourly' | 'session', record: UsageRecord): void {
    const key = this.getStorageKey(type);
    const serialized = JSON.stringify({
      ...record,
      lastUsed: record.lastUsed.toISOString()
    });
    
    localStorage.setItem(key, serialized);
    
    // 为会话计数设置会话标记
    if (type === 'session') {
      sessionStorage.setItem(key, 'active');
    }
  }

  /**
   * 检查是否可以使用
   */
  public canUse(): { allowed: boolean; reason?: string; resetTime?: Date } {
    const dailyUsage = this.getCurrentUsage('daily');
    const hourlyUsage = this.getCurrentUsage('hourly');
    const sessionUsage = this.getCurrentUsage('session');

    // 检查日限制
    if (dailyUsage.count >= this.limits.daily) {
      const nextReset = new Date();
      nextReset.setDate(nextReset.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);
      
      return {
        allowed: false,
        reason: `今日生成次数已达上限（${this.limits.daily}次），请明天再试`,
        resetTime: nextReset
      };
    }

    // 检查小时限制
    if (hourlyUsage.count >= this.limits.hourly) {
      const nextReset = new Date();
      nextReset.setHours(nextReset.getHours() + 1, 0, 0, 0);
      
      return {
        allowed: false,
        reason: `每小时生成次数已达上限（${this.limits.hourly}次），请稍后再试`,
        resetTime: nextReset
      };
    }

    // 检查会话限制
    if (sessionUsage.count >= this.limits.perSession) {
      return {
        allowed: false,
        reason: `本次会话生成次数已达上限（${this.limits.perSession}次），刷新页面可重置`,
        resetTime: undefined
      };
    }

    return { allowed: true };
  }

  /**
   * 记录一次使用
   */
  public recordUsage(): void {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 更新所有类型的使用记录
    ['daily', 'hourly', 'session'].forEach(type => {
      const currentUsage = this.getCurrentUsage(type as any);
      const updatedUsage: UsageRecord = {
        count: currentUsage.count + 1,
        lastUsed: now,
        resetDate: today
      };
      this.saveUsageRecord(type as any, updatedUsage);
    });
  }

  /**
   * 获取使用统计
   */
  public getUsageStats(): {
    daily: { used: number; limit: number; remaining: number };
    hourly: { used: number; limit: number; remaining: number };
    session: { used: number; limit: number; remaining: number };
  } {
    const dailyUsage = this.getCurrentUsage('daily');
    const hourlyUsage = this.getCurrentUsage('hourly');
    const sessionUsage = this.getCurrentUsage('session');

    return {
      daily: {
        used: dailyUsage.count,
        limit: this.limits.daily,
        remaining: Math.max(0, this.limits.daily - dailyUsage.count)
      },
      hourly: {
        used: hourlyUsage.count,
        limit: this.limits.hourly,
        remaining: Math.max(0, this.limits.hourly - hourlyUsage.count)
      },
      session: {
        used: sessionUsage.count,
        limit: this.limits.perSession,
        remaining: Math.max(0, this.limits.perSession - sessionUsage.count)
      }
    };
  }

  /**
   * 获取设备指纹信息（用于调试）
   */
  public getFingerprint(): Partial<DeviceFingerprint> {
    return {
      hash: this.fingerprint.hash,
      platform: this.fingerprint.platform,
      language: this.fingerprint.language
    };
  }

  /**
   * 重置使用量（仅用于开发/测试）
   */
  public resetUsage(): void {
    // 检查是否为开发环境（通过 import.meta.env 或 localhost 检测）
    const isDevelopment = import.meta.env?.DEV || location.hostname === 'localhost';
    
    if (isDevelopment) {
      ['daily', 'hourly', 'session'].forEach(type => {
        const key = this.getStorageKey(type as any);
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      console.log('使用量已重置');
    }
  }
} 