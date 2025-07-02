// 使用量追踪服务 - 无需登录的客户端限流方案

interface UsageStats {
  daily: { used: number; limit: number; remaining: number };
  hourly: { used: number; limit: number; remaining: number };
  session: { used: number; limit: number; remaining: number };
}

interface UsageCheck {
  allowed: boolean;
  reason?: string;
}

export class UsageTracker {
  private static instance: UsageTracker;
  private deviceFingerprint: string;
  
  // 限制配置
  private readonly limits = {
    daily: 20,    // 每日20次
    hourly: 10,   // 每小时10次
    session: 5,   // 每会话5次
  };

  private constructor() {
    this.deviceFingerprint = this.generateDeviceFingerprint();
  }

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * 生成设备指纹（基于浏览器特征）
   */
  private generateDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');

    // 简单hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32bit整数
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * 获取今天的日期字符串
   */
  private getTodayKey(): string {
    return new Date().toDateString();
  }

  /**
   * 获取当前小时的键值
   */
  private getCurrentHourKey(): string {
    const now = new Date();
    return `${now.toDateString()}-${now.getHours()}`;
  }

  /**
   * 获取会话存储键
   */
  private getSessionKey(): string {
    return `session_usage_${this.deviceFingerprint}`;
  }

  /**
   * 检查是否可以使用
   */
  canUse(): UsageCheck {
    const stats = this.getUsageStats();

    if (stats.daily.remaining <= 0) {
      return {
        allowed: false,
        reason: `今日生成次数已用完 (${stats.daily.limit}/${stats.daily.limit})，请明天再来`,
      };
    }

    if (stats.hourly.remaining <= 0) {
      return {
        allowed: false,
        reason: `本小时生成次数已用完 (${stats.hourly.limit}/${stats.hourly.limit})，请一小时后再试`,
      };
    }

    if (stats.session.remaining <= 0) {
      return {
        allowed: false,
        reason: `本次会话生成次数已用完 (${stats.session.limit}/${stats.session.limit})，请刷新页面重新开始`,
      };
    }

    return { allowed: true };
  }

  /**
   * 记录一次使用
   */
  recordUsage(): void {
    const todayKey = this.getTodayKey();
    const hourKey = this.getCurrentHourKey();
    const sessionKey = this.getSessionKey();

    // 更新日使用量（localStorage）
    const dailyUsage = parseInt(localStorage.getItem(`daily_usage_${this.deviceFingerprint}_${todayKey}`) || '0');
    localStorage.setItem(`daily_usage_${this.deviceFingerprint}_${todayKey}`, (dailyUsage + 1).toString());

    // 更新小时使用量（localStorage）
    const hourlyUsage = parseInt(localStorage.getItem(`hourly_usage_${this.deviceFingerprint}_${hourKey}`) || '0');
    localStorage.setItem(`hourly_usage_${this.deviceFingerprint}_${hourKey}`, (hourlyUsage + 1).toString());

    // 更新会话使用量（sessionStorage）
    const sessionUsage = parseInt(sessionStorage.getItem(sessionKey) || '0');
    sessionStorage.setItem(sessionKey, (sessionUsage + 1).toString());

    // 清理过期数据
    this.cleanupExpiredData();
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): UsageStats {
    const todayKey = this.getTodayKey();
    const hourKey = this.getCurrentHourKey();
    const sessionKey = this.getSessionKey();

    const dailyUsed = parseInt(localStorage.getItem(`daily_usage_${this.deviceFingerprint}_${todayKey}`) || '0');
    const hourlyUsed = parseInt(localStorage.getItem(`hourly_usage_${this.deviceFingerprint}_${hourKey}`) || '0');
    const sessionUsed = parseInt(sessionStorage.getItem(sessionKey) || '0');

    return {
      daily: {
        used: dailyUsed,
        limit: this.limits.daily,
        remaining: Math.max(0, this.limits.daily - dailyUsed),
      },
      hourly: {
        used: hourlyUsed,
        limit: this.limits.hourly,
        remaining: Math.max(0, this.limits.hourly - hourlyUsed),
      },
      session: {
        used: sessionUsed,
        limit: this.limits.session,
        remaining: Math.max(0, this.limits.session - sessionUsed),
      },
    };
  }

  /**
   * 清理过期数据
   */
  private cleanupExpiredData(): void {
    const now = new Date();

    // 清理过期的日数据（保留最近7天）
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`daily_usage_${this.deviceFingerprint}_`)) {
        const dateStr = key.replace(`daily_usage_${this.deviceFingerprint}_`, '');
        const date = new Date(dateStr);
        const daysDiff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        
        if (daysDiff > 7) {
          localStorage.removeItem(key);
        }
      }
    }

    // 清理过期的小时数据（保留最近24小时）
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`hourly_usage_${this.deviceFingerprint}_`)) {
        const hourKey = key.replace(`hourly_usage_${this.deviceFingerprint}_`, '');
        const [dateStr, hourStr] = hourKey.split('-');
        const date = new Date(dateStr);
        const hour = parseInt(hourStr);
        
        const keyTime = new Date(date);
        keyTime.setHours(hour);
        
        const hoursDiff = (now.getTime() - keyTime.getTime()) / (1000 * 3600);
        
        if (hoursDiff > 24) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  /**
   * 重置会话使用量（用于测试）
   */
  resetSessionUsage(): void {
    const sessionKey = this.getSessionKey();
    sessionStorage.removeItem(sessionKey);
  }

  /**
   * 获取设备指纹（用于调试）
   */
  getDeviceFingerprint(): string {
    return this.deviceFingerprint;
  }
} 