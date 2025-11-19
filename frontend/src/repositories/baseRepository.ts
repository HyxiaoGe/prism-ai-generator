/**
 * 基础仓库类
 * 提供 Supabase 客户端访问和通用数据库操作
 */

import { supabase } from '../config/supabase';

export class BaseRepository {
  protected supabase = supabase;

  /**
   * 获取 Supabase 客户端
   * 用于需要直接访问客户端的特殊操作
   */
  getClient() {
    return this.supabase;
  }
}

/**
 * 设备指纹生成器
 * 用于生成唯一的设备标识
 */
export class DeviceFingerprint {
  private static instance: DeviceFingerprint;
  private cachedFingerprint: string | null = null;

  static getInstance(): DeviceFingerprint {
    if (!DeviceFingerprint.instance) {
      DeviceFingerprint.instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.instance;
  }

  /**
   * 生成设备指纹
   */
  async generateFingerprint(): Promise<string> {
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    const factors = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      ('deviceMemory' in navigator ? (navigator as any).deviceMemory : 0) || 0,
    ];

    // 如果支持 canvas 指纹
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        factors.push(canvas.toDataURL());
      }
    } catch (e) {
      // Canvas 指纹生成失败，忽略
    }

    // 生成简单的 hash
    const text = factors.join('|');
    const hash = await this.simpleHash(text);

    this.cachedFingerprint = hash;
    return hash;
  }

  /**
   * 简单的 hash 函数
   */
  private async simpleHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // 取前32位作为设备指纹
  }
}
