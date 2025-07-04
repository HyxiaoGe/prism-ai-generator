import { supabase } from '../config/supabase';
import type { 
  User, 
  Generation, 
  PromptStats, 
  DailyStats, 
  UserUsageStats 
} from '../types/database';

/**
 * 设备指纹生成器
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
      // 使用类型安全的方式访问 deviceMemory
      ('deviceMemory' in navigator ? (navigator as any).deviceMemory : 0) || 0,
    ];

    // 如果支持canvas指纹
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
      // Canvas指纹生成失败，忽略
    }

    // 生成简单的hash
    const text = factors.join('|');
    const hash = await this.simpleHash(text);
    
    this.cachedFingerprint = hash;
    return hash;
  }

  /**
   * 简单的hash函数
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

/**
 * 数据库服务类
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private deviceFingerprint: DeviceFingerprint;

  private constructor() {
    this.deviceFingerprint = DeviceFingerprint.getInstance();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 获取或创建用户
   */
  async getOrCreateUser(): Promise<User> {
    const fingerprint = await this.deviceFingerprint.generateFingerprint();
    
    // 首先尝试获取用户
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('device_fingerprint', fingerprint)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 是 "not found" 错误，其他错误需要抛出
      throw new Error(`获取用户失败: ${fetchError.message}`);
    }

    if (existingUser) {
      // 检查是否需要重置每日配额
      const today = new Date().toISOString().split('T')[0];
      if (existingUser.last_reset_date !== today) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            used_today: 0,
            last_reset_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`重置每日配额失败: ${updateError.message}`);
        }

        return updatedUser;
      }

      return existingUser;
    }

    // 创建新用户
    const { data: newUser, error: createError } = await supabase
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

    if (createError) {
      throw new Error(`创建用户失败: ${createError.message}`);
    }

    return newUser;
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(): Promise<UserUsageStats> {
    const user = await this.getOrCreateUser();
    
    return {
      daily: {
        used: user.used_today,
        limit: user.daily_quota,
        remaining: user.daily_quota - user.used_today,
      },
      total: {
        generated: user.total_generated,
        cost: 0, // 可以从generations表计算
      },
    };
  }

  /**
   * 检查用户是否可以生成图像
   */
  async canUserGenerate(): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.getOrCreateUser();
    
    if (user.used_today >= user.daily_quota) {
      return {
        allowed: false,
        reason: `每日配额已用完 (${user.used_today}/${user.daily_quota})`,
      };
    }

    return { allowed: true };
  }

  /**
   * 记录用户使用
   */
  async recordUsage(userId?: string): Promise<void> {
    const user = userId ? 
      await this.getUserById(userId) : 
      await this.getOrCreateUser();

    if (!user) {
      throw new Error('用户不存在');
    }

    const { error } = await supabase
      .from('users')
      .update({
        used_today: user.used_today + 1,
        total_generated: user.total_generated + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      throw new Error(`记录使用失败: ${error.message}`);
    }
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
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
   * 保存生成记录
   */
  async saveGeneration(generation: {
    prompt: string;
    model_name: string;
    model_cost: number;
    image_urls: string[];
    status?: 'pending' | 'completed' | 'failed';
    is_public?: boolean;
  }): Promise<Generation> {
    const user = await this.getOrCreateUser();

    const { data, error } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        prompt: generation.prompt,
        model_name: generation.model_name,
        model_cost: generation.model_cost,
        image_urls: generation.image_urls,
        status: generation.status || 'completed',
        is_public: generation.is_public !== false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`保存生成记录失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取用户生成历史
   */
  async getUserGenerations(limit: number = 50): Promise<Generation[]> {
    const user = await this.getOrCreateUser();

    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取生成历史失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取公开的生成记录（用于画廊）
   */
  async getPublicGenerations(limit: number = 100): Promise<Generation[]> {
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取公开生成记录失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 更新或创建提示词统计
   */
  async updatePromptStats(promptText: string): Promise<void> {
    // 首先尝试获取现有统计
    const { data: existing, error: fetchError } = await supabase
      .from('prompt_stats')
      .select('*')
      .eq('prompt_text', promptText)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`获取提示词统计失败: ${fetchError.message}`);
    }

    if (existing) {
      // 更新现有统计
      const { error: updateError } = await supabase
        .from('prompt_stats')
        .update({
          usage_count: existing.usage_count + 1,
          last_used: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`更新提示词统计失败: ${updateError.message}`);
      }
    } else {
      // 创建新统计
      const { error: insertError } = await supabase
        .from('prompt_stats')
        .insert({
          prompt_text: promptText,
          usage_count: 1,
          last_used: new Date().toISOString(),
          average_rating: 0,
        });

      if (insertError) {
        throw new Error(`创建提示词统计失败: ${insertError.message}`);
      }
    }
  }

  /**
   * 获取热门提示词
   */
  async getPopularPrompts(limit: number = 10): Promise<PromptStats[]> {
    const { data, error } = await supabase
      .from('prompt_stats')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取热门提示词失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 更新每日统计
   */
  async updateDailyStats(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // 获取今日统计数据
    const { data: generationsToday, error: genError } = await supabase
      .from('generations')
      .select('model_cost')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    if (genError) {
      throw new Error(`获取今日生成数据失败: ${genError.message}`);
    }

    const { data: usersToday, error: usersError } = await supabase
      .from('users')
      .select('id')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    if (usersError) {
      throw new Error(`获取今日用户数据失败: ${usersError.message}`);
    }

    const totalGenerations = generationsToday?.length || 0;
    const totalUsers = usersToday?.length || 0;
    const totalCost = generationsToday?.reduce((sum, gen) => sum + (gen.model_cost || 0), 0) || 0;

    // 更新或创建每日统计
    const { error: upsertError } = await supabase
      .from('daily_stats')
      .upsert({
        date: today,
        total_generations: totalGenerations,
        total_users: totalUsers,
        total_cost: totalCost,
        popular_prompts: [], // 可以后续实现
      });

    if (upsertError) {
      throw new Error(`更新每日统计失败: ${upsertError.message}`);
    }
  }

  /**
   * 获取每日统计
   */
  async getDailyStats(days: number = 7): Promise<DailyStats[]> {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(days);

    if (error) {
      throw new Error(`获取每日统计失败: ${error.message}`);
    }

    return data || [];
  }
} 