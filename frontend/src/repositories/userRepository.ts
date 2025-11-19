/**
 * 用户仓库
 * 处理用户相关的数据库操作
 */

import { BaseRepository, DeviceFingerprint } from './baseRepository';
import type { User } from '../types/database';

export class UserRepository extends BaseRepository {
  private static instance: UserRepository;
  private deviceFingerprint: DeviceFingerprint;

  private constructor() {
    super();
    this.deviceFingerprint = DeviceFingerprint.getInstance();
  }

  static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  /**
   * 根据设备指纹获取用户
   */
  async findByFingerprint(fingerprint: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('device_fingerprint', fingerprint)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`获取用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 根据 ID 获取用户
   */
  async findById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`获取用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 创建新用户
   */
  async create(fingerprint: string): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        device_fingerprint: fingerprint,
        daily_quota: 10,
        used_today: 0,
        last_reset_date: new Date().toISOString().split('T')[0],
        total_generated: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 更新用户信息
   */
  async update(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新用户失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 重置每日配额
   */
  async resetDailyQuota(userId: string): Promise<User> {
    const today = new Date().toISOString().split('T')[0];
    return this.update(userId, {
      used_today: 0,
      last_reset_date: today,
    });
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(userId: string, currentUsedToday: number, currentTotalGenerated: number): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({
        used_today: currentUsedToday + 1,
        total_generated: currentTotalGenerated + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`记录使用失败: ${error.message}`);
    }
  }

  /**
   * 获取当前设备指纹
   */
  async getCurrentFingerprint(): Promise<string> {
    return this.deviceFingerprint.generateFingerprint();
  }
}
