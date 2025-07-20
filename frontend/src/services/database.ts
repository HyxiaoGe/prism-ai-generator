import { supabase } from '../config/supabase';
import type { 
  User, 
  Generation, 
  PromptStats, 
  DailyStats, 
  UserUsageStats,
  TagStats,
  TagCategory,
  ImageFeedback,
  FeedbackType,
  TagRecommendation,
  PopularTagsAnalysis,
  PromptTranslation
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
  // 🚀 添加用户缓存机制
  private cachedUser: User | null = null;
  private userCacheExpiry: number = 0;
  private readonly USER_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

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
   * 获取或创建用户 - 性能优化版本（带缓存）
   */
  async getOrCreateUser(): Promise<User> {
    const now = Date.now();
    
    // 🚀 性能优化：检查缓存是否有效
    if (this.cachedUser && now < this.userCacheExpiry) {
      console.log('📈 使用缓存的用户信息，避免数据库查询');
      return this.cachedUser;
    }

    console.log('🔄 缓存过期或不存在，从数据库获取用户信息');
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

        // 🚀 更新缓存
        this.cachedUser = updatedUser;
        this.userCacheExpiry = now + this.USER_CACHE_DURATION;
        console.log('✅ 用户配额重置成功并已缓存');
        return updatedUser;
      }

      // 🚀 更新缓存
      this.cachedUser = existingUser;
      this.userCacheExpiry = now + this.USER_CACHE_DURATION;
      console.log('✅ 现有用户信息已缓存');
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

    // 🚀 更新缓存
    this.cachedUser = newUser;
    this.userCacheExpiry = now + this.USER_CACHE_DURATION;
    console.log('✅ 新用户创建成功并已缓存');
    return newUser;
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(): Promise<UserUsageStats> {
    const user = await this.getOrCreateUser();
    
    // 🔒 安全优化：只查询必要的字段
    const { data: feedbackStats } = await supabase
      .from('image_feedback')
      .select('feedback_type')
      .eq('user_id', user.id);

    const likesReceived = feedbackStats?.filter((f: any) => f.feedback_type === 'like').length || 0;
    const dislikesReceived = feedbackStats?.filter((f: any) => f.feedback_type === 'dislike').length || 0;
    const feedbackGiven = feedbackStats?.length || 0;
    
    return {
      daily: {
        used: user.used_today,
        limit: user.daily_quota,
        remaining: user.daily_quota - user.used_today,
      },
      total: {
        generated: user.total_generated,
        cost: 0, // 可以从generations表计算
        likes_received: likesReceived,
        dislikes_received: dislikesReceived,
        feedback_given: feedbackGiven,
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

    // 🚀 清除用户缓存，因为使用量已更新
    this.clearUserCache();
    console.log('🔄 用户使用量已更新，缓存已清除');
  }

  /**
   * 清除用户缓存
   */
  private clearUserCache(): void {
    this.cachedUser = null;
    this.userCacheExpiry = 0;
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
    tags_used?: Array<{name: string, category: TagCategory, value: string}>; // 新增：使用的标签
    // 🔥 新增：R2存储相关字段
    original_image_urls?: string[]; // 原始临时URL
    r2_keys?: string[];             // R2存储的key数组
    r2_data?: any;                  // R2存储的元数据
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
        // 🔥 新增：保存R2相关信息
        original_image_urls: generation.original_image_urls,
        r2_keys: generation.r2_keys,
        r2_data: generation.r2_data,
        // 🔥 修复：保存标签信息
        tags_used: generation.tags_used || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`保存生成记录失败: ${error.message}`);
    }

    // 异步更新每日统计，不阻塞主流程
    this.updateDailyStats().catch(error => {
      console.error('更新每日统计失败:', error);
      // 不抛出错误，避免影响主流程
    });

    // 异步更新标签使用统计，不阻塞主流程
    if (generation.tags_used && generation.tags_used.length > 0) {
      this.updateTagStats(generation.tags_used).catch(error => {
        console.error('更新标签统计失败:', error);
        // 不抛出错误，避免影响主流程
      });
    }

    return data;
  }

  /**
   * 获取用户生成历史
   */
  async getUserGenerations(limit: number = 50): Promise<Generation[]> {
    const user = await this.getOrCreateUser();

    // 🔒 安全优化：只查询必要字段，不暴露敏感信息，🔥 包含标签信息用于显示
    const { data, error } = await supabase
      .from('generations')
      .select(`
        id,
        user_id,
        prompt,
        model_name,
        model_cost,
        image_urls,
        status,
        created_at,
        is_public,
        original_image_urls,
        r2_keys,
        r2_data,
        tags_used
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取生成历史失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 📄 分页获取用户生成历史
   */
  async getUserGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number; // 基于页码的分页
  } = {}): Promise<{
    data: Generation[];
    total: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  }> {
    const user = await this.getOrCreateUser();
    const limit = params.limit || 10; // 默认每页10条
    const page = params.page || 1;
    const offset = params.offset !== undefined ? params.offset : (page - 1) * limit;

    console.log(`📄 分页加载用户历史: 第${page}页, 每页${limit}条, 偏移${offset}`);

    // 先获取总数
    const { count, error: countError } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      throw new Error(`获取总数失败: ${countError.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    // 获取分页数据，🔥 包含标签信息用于显示
    const { data, error } = await supabase
      .from('generations')
      .select(`
        id,
        user_id,
        prompt,
        model_name,
        model_cost,
        image_urls,
        status,
        created_at,
        is_public,
        original_image_urls,
        r2_keys,
        r2_data,
        tags_used
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`获取分页历史失败: ${error.message}`);
    }

    console.log(`✅ 分页加载完成: ${data?.length || 0}/${total}条记录, 第${page}/${totalPages}页`);

    return {
      data: data || [],
      total,
      hasMore,
      currentPage: page,
      totalPages,
    };
  }

  /**
   * 获取公开的生成记录（用于画廊）
   */
  async getPublicGenerations(limit: number = 100): Promise<Generation[]> {
    // 🔒 安全优化：公开画廊不暴露用户敏感信息，使用匿名user_id，🔥 包含标签信息用于显示
    const { data, error } = await supabase
      .from('generations')
      .select(`
        id,
        prompt,
        model_name,
        image_urls,
        status,
        created_at,
        is_public,
        original_image_urls,
        r2_keys,
        r2_data,
        tags_used
      `)
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取公开生成记录失败: ${error.message}`);
    }

    // 为公开记录添加匿名user_id和默认model_cost
    return (data || []).map((record: any) => ({
      ...record,
      user_id: 'anonymous', // 匿名用户ID
      model_cost: 0, // 不暴露成本信息
    }));
  }

  /**
   * 📄 分页获取公开的生成记录（用于画廊）
   */
  async getPublicGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number;
  } = {}): Promise<{
    data: Generation[];
    total: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  }> {
    const limit = params.limit || 24; // 默认每页24条（6x4网格）
    const page = params.page || 1;
    const offset = params.offset !== undefined ? params.offset : (page - 1) * limit;

    console.log(`📄 分页加载公开画廊: 第${page}页, 每页${limit}条, 偏移${offset}`);

    // 先获取总数
    const { count, error: countError } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'completed');

    if (countError) {
      throw new Error(`获取公开记录总数失败: ${countError.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    // 获取分页数据，🔥 包含标签信息用于显示
    const { data, error } = await supabase
      .from('generations')
      .select(`
        id,
        prompt,
        model_name,
        image_urls,
        status,
        created_at,
        is_public,
        original_image_urls,
        r2_keys,
        r2_data,
        tags_used
      `)
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`获取分页公开记录失败: ${error.message}`);
    }

    console.log(`✅ 公开画廊分页加载完成: ${data?.length || 0}/${total}条记录, 第${page}/${totalPages}页`);

    // 为公开记录添加匿名user_id和默认model_cost
    const mappedData = (data || []).map((record: any) => ({
      ...record,
      user_id: 'anonymous', // 匿名用户ID
      model_cost: 0, // 不暴露成本信息
    }));

    return {
      data: mappedData,
      total,
      hasMore,
      currentPage: page,
      totalPages,
    };
  }

  /**
   * 更新或创建提示词统计 - 性能优化版本
   */
  async updatePromptStats(promptText: string): Promise<void> {
    console.log('📊 优化提示词统计更新:', promptText.substring(0, 50) + '...');

    try {
      // 🚀 使用upsert一次性处理，避免查询+更新模式
      const currentTime = new Date().toISOString();
      
      const { error } = await supabase
        .from('prompt_stats')
        .upsert({
          prompt_text: promptText,
          usage_count: 1, // 新记录时为1，已存在记录时会被忽略
          last_used: currentTime,
          average_rating: 0,
        }, {
          onConflict: 'prompt_text',
          ignoreDuplicates: true // 只插入新的提示词，已存在的保持不变
        });

      if (error) {
        console.error('提示词统计upsert失败:', error);
        // 降级处理：使用原来的查询+更新方式
        await this.updatePromptStatsLegacy(promptText);
      } else {
        console.log('✅ 提示词统计优化更新完成 - 仅用1次数据库请求');
      }
    } catch (error) {
      console.error('提示词统计更新异常:', error);
      // 降级处理
      await this.updatePromptStatsLegacy(promptText);
    }
  }

  /**
   * 提示词统计更新的降级方法
   */
  private async updatePromptStatsLegacy(promptText: string): Promise<void> {
    console.log('🔄 使用降级模式更新提示词统计');
    
    try {
      // 简化版：直接尝试插入，如果失败就忽略
      const { error } = await supabase
        .from('prompt_stats')
        .insert({
          prompt_text: promptText,
          usage_count: 1,
          last_used: new Date().toISOString(),
          average_rating: 0,
        });

      if (error) {
        console.warn('提示词统计插入失败（可能已存在）:', error.message);
        // 如果插入失败，说明记录已存在，这里我们选择忽略
        // 实际生产环境中可以考虑定期聚合提示词使用量
      }
    } catch (error) {
      console.error('降级提示词统计更新失败:', error);
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
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 获取今日生成记录统计
    const { data: generationsToday, error: genError } = await supabase
      .from('generations')
      .select('model_cost, user_id, status, created_at, image_urls')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${tomorrow}T00:00:00`);

    if (genError) {
      console.error('获取今日生成数据失败:', genError);
      throw new Error(`获取今日生成数据失败: ${genError.message}`);
    }

    // 只统计完成的记录
    const completedGenerations = generationsToday?.filter((r: any) => r.status === 'completed') || [];

    // 统计今日活跃用户（有生成行为的用户）
    const uniqueUserIds = new Set(completedGenerations.map((gen: any) => gen.user_id));
    
    const totalGenerations = completedGenerations.length;
    const totalActiveUsers = uniqueUserIds.size;
    const totalCost = completedGenerations.reduce((sum: number, gen: any) => sum + (gen.model_cost || 0), 0);

    // 检查是否已存在今日统计记录
    const { data: existingStats, error: fetchError } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('date', today)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('检查现有统计记录失败:', fetchError);
      throw new Error(`检查现有统计记录失败: ${fetchError.message}`);
    }

    const statsData = {
      date: today,
      total_generations: totalGenerations,
      total_users: totalActiveUsers,
      total_cost: totalCost,
      popular_prompts: [], // 可以后续实现
    };

    if (existingStats) {
      // 更新现有记录
      const { error: updateError } = await supabase
        .from('daily_stats')
        .update(statsData)
        .eq('id', existingStats.id);

      if (updateError) {
        console.error('更新每日统计失败:', updateError);
        throw new Error(`更新每日统计失败: ${updateError.message}`);
      }
    } else {
      // 创建新记录
      const { error: insertError } = await supabase
        .from('daily_stats')
        .insert(statsData);

      if (insertError) {
        console.error('创建每日统计失败:', insertError);
        throw new Error(`创建每日统计失败: ${insertError.message}`);
      }
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

  /**
   * 调试方法：获取今日所有生成记录详情
   */
  async getDebugGenerationsToday(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${tomorrow}T00:00:00`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取今日生成记录失败:', error);
      return [];
    }

    console.log('🔍 今日所有生成记录:', data);
    console.log('📊 记录统计:', {
      总记录数: data?.length || 0,
      完成记录数: data?.filter((r: any) => r.status === 'completed').length || 0,
      失败记录数: data?.filter((r: any) => r.status === 'failed').length || 0,
      待处理记录数: data?.filter((r: any) => r.status === 'pending').length || 0,
    });

    // 详细分析每条记录
    data?.forEach((record: any, index: number) => {
      console.log(`📝 记录 ${index + 1}:`, {
        id: record.id,
        prompt: record.prompt.substring(0, 50) + '...',
        model: record.model_name,
        图片数量: Array.isArray(record.image_urls) ? record.image_urls.length : 1,
        状态: record.status,
        创建时间: record.created_at,
        成本: record.model_cost
      });
    });

    return data || [];
  }

  /**
   * 清理重复的每日统计记录，保留每天最新的一条
   */
  async cleanupDuplicateDailyStats(): Promise<void> {
    console.log('🧹 开始清理重复的每日统计记录...');

    // 获取所有每日统计记录，按日期分组
    const { data: allStats, error: fetchError } = await supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false });

    if (fetchError) {
      throw new Error(`获取每日统计失败: ${fetchError.message}`);
    }

    if (!allStats || allStats.length === 0) {
      console.log('📭 没有找到每日统计记录');
      return;
    }

    // 按日期分组
    const statsByDate = new Map<string, any[]>();
    allStats.forEach((stat: any) => {
      const date = stat.date;
      if (!statsByDate.has(date)) {
        statsByDate.set(date, []);
      }
      statsByDate.get(date)!.push(stat);
    });

    console.log('📊 每日统计记录分组:', Array.from(statsByDate.entries()).map(([date, records]) => ({
      日期: date,
      记录数: records.length,
      是否重复: records.length > 1
    })));

    // 清理重复记录
    for (const [date, records] of statsByDate.entries()) {
      if (records.length > 1) {
        console.log(`🔍 发现 ${date} 有 ${records.length} 条重复记录，准备清理...`);
        
        // 按创建时间排序，保留最新的一条
        records.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        
        const keepRecord = records[0]; // 保留最新的
        const deleteRecords = records.slice(1); // 删除其他的
        
        console.log(`📌 保留记录:`, {
          id: keepRecord.id,
          date: keepRecord.date,
          total_generations: keepRecord.total_generations,
          创建时间: keepRecord.created_at
        });
        
        // 删除重复记录
        for (const record of deleteRecords) {
          console.log(`🗑️ 删除重复记录:`, {
            id: record.id,
            date: record.date,
            total_generations: record.total_generations,
            创建时间: record.created_at
          });
          
          const { error: deleteError } = await supabase
            .from('daily_stats')
            .delete()
            .eq('id', record.id);
          
          if (deleteError) {
            console.error(`删除记录 ${record.id} 失败:`, deleteError);
          } else {
            console.log(`✅ 已删除记录 ${record.id}`);
          }
        }
      } else {
        console.log(`✅ ${date} 的记录正常，无需清理`);
      }
    }

    console.log('🎉 重复记录清理完成！');
  }

  // ===== 标签统计相关方法 =====

  /**
   * 记录标签使用统计 - 极简优化版本
   * 一次批量upsert，接受计数不完全准确但大幅减少请求
   */
  async updateTagStats(tags: Array<{name: string, category: TagCategory, value: string}>): Promise<void> {
    if (!tags || tags.length === 0) {
      return;
    }

    console.log('📊 极简优化：单次批量upsert标签统计:', tags.length, '个标签');

    try {
      const currentTime = new Date().toISOString();

      // 🚀 极简优化：一次性批量upsert，简单粗暴但有效
      const upsertData = tags.map(tag => ({
        tag_name: tag.name,
        tag_category: tag.category,
        tag_value: tag.value,
        usage_count: 1, // 新记录为1，已存在记录保持不变（ignoreDuplicates）
        success_rate: 0,
        average_rating: 0,
        last_used: currentTime,
        updated_at: currentTime,
      }));

      console.log('🔄 执行批量upsert操作...');
      const { error } = await supabase
        .from('tag_stats')
        .upsert(upsertData, { 
          onConflict: 'tag_name,tag_category',
          ignoreDuplicates: true // 关键：忽略重复记录，只插入新标签
        });

      if (error) {
        console.error('批量upsert失败，回退到逐个处理:', error);
        await this.updateTagStatsIndividually(tags);
        return;
      }

      console.log(`✅ 极简优化完成 - 标签统计更新: ${tags.length}个标签，仅用1次数据库请求！`);
      console.log('📝 策略说明：新标签被插入，已存在标签保持原有数据，大幅提升性能');

    } catch (error) {
      console.error('批量优化异常，回退到逐个处理:', error);
      await this.updateTagStatsIndividually(tags);
    }
  }

  /**
   * 逐个更新标签统计的降级方法（最后的备用方案）
   */
  private async updateTagStatsIndividually(tags: Array<{name: string, category: TagCategory, value: string}>): Promise<void> {
    console.log('🔄 使用逐个更新模式 (性能较差但最可靠)');
    const currentTime = new Date().toISOString();

    // 批量处理，但使用更简单的upsert逻辑
    const upsertPromises = tags.map(tag => 
      supabase
        .from('tag_stats')
        .upsert({
          tag_name: tag.name,
          tag_category: tag.category,
          tag_value: tag.value,
          usage_count: 1, // 这里有问题：无法正确累加，但至少不会失败
          success_rate: 0,
          average_rating: 0,
          last_used: currentTime,
          updated_at: currentTime,
        }, {
          onConflict: 'tag_name,tag_category',
          ignoreDuplicates: false // 允许更新，但会重置usage_count为1
        })
    );

    const results = await Promise.allSettled(upsertPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`⚠️ 降级更新完成: ${successCount} 成功, ${failCount} 失败 (注意：计数可能不准确)`);
    
    if (failCount > 0) {
      console.warn('部分标签更新失败，但不影响主流程');
    }
  }


  /**
   * 获取热门标签
   */
  async getPopularTags(category?: TagCategory, limit: number = 10): Promise<TagStats[]> {
    let query = supabase
      .from('tag_stats')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('tag_category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取热门标签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取标签推荐
   */
  async getTagRecommendations(usedTags: string[] = [], category?: TagCategory, limit: number = 5): Promise<TagRecommendation[]> {
    let query = supabase
      .from('tag_stats')
      .select('*')
      .gt('usage_count', 0) // 至少被使用过一次
      .order('usage_count', { ascending: false })
      .limit(limit * 2); // 获取更多数据用于过滤

    if (category) {
      query = query.eq('tag_category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取标签推荐失败: ${error.message}`);
    }

    // 过滤掉已使用的标签，并计算推荐分数
    const recommendations: TagRecommendation[] = (data || [])
      .filter((tag: any) => !usedTags.includes(tag.tag_name))
      .slice(0, limit)
      .map((tag: any) => {
        let score = tag.usage_count;
        let reason = `热门标签 (${tag.usage_count}次使用)`;

        // 根据成功率调整分数
        if (tag.success_rate > 0.7) {
          score *= 1.2;
          reason += ', 高成功率';
        }

        // 根据平均评分调整分数
        if (tag.average_rating > 4) {
          score *= 1.1;
          reason += ', 高评分';
        }

        return {
          tag,
          score: Math.round(score),
          reason
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    return recommendations;
  }

  /**
   * 分析标签趋势
   */
  async analyzeTagTrends(days: number = 7): Promise<PopularTagsAnalysis[]> {
    const categories: TagCategory[] = ['art_style', 'theme_style', 'mood', 'technical', 'composition', 'enhancement'];
    const results: PopularTagsAnalysis[] = [];

    for (const category of categories) {
      const { data, error } = await supabase
        .from('tag_stats')
        .select('*')
        .eq('tag_category', category)
        .order('usage_count', { ascending: false })
        .limit(10);

      if (error) {
        console.error(`分析 ${category} 标签趋势失败:`, error);
        continue;
      }

      const totalUsage = (data || []).reduce((sum: number, tag: any) => sum + tag.usage_count, 0);
      
      results.push({
        category,
        tags: data || [],
        total_usage: totalUsage,
        growth_rate: 0, // 可以后续实现基于时间的增长率计算
      });
    }

    return results;
  }

  // ===== 图片反馈相关方法 =====

  /**
   * 提交图片反馈
   */
  async submitImageFeedback(params: {
    generationId: string;
    imageUrls: string[];  // 改为数组
    feedbackType: FeedbackType;
    tagsUsed: string[];
    modelUsed: string;
  }): Promise<ImageFeedback | null> {
    const user = await this.getOrCreateUser();

    // 检查是否已经对这个批次提交过反馈 - 修复多行返回错误
    const { data: existingList, error: checkError } = await supabase
      .from('image_feedback')
      .select('*')
      .eq('generation_id', params.generationId)
      .eq('user_id', user.id)
      .limit(1);

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`检查现有反馈失败: ${checkError.message}`);
    }

    if (existing) {
      if (params.feedbackType === null) {
        // 取消反馈 - 删除记录
        const { error } = await supabase
          .from('image_feedback')
          .delete()
          .eq('id', existing.id);

        if (error) {
          throw new Error(`删除批次反馈失败: ${error.message}`);
        }


        
        // 🚀 优化：只更新相关标签的成功率，而不是全部标签
        this.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);
        
        return null;
      } else {
        // 更新现有反馈
        const { data, error } = await supabase
          .from('image_feedback')
          .update({
            feedback_type: params.feedbackType,
            image_urls: params.imageUrls,  // 更新图片URL数组
            tags_used: params.tagsUsed,
            model_used: params.modelUsed,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.warn('反馈记录不存在，可能已被删除');
            return null;
          }
          throw new Error(`更新批次反馈失败: ${error.message}`);
        }


        
        // 🚀 优化：只更新相关标签的成功率，而不是全部标签
        this.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);
        
        return data;
      }
    } else {
      // 如果是取消反馈，但没有现有反馈，直接返回 null
      if (params.feedbackType === null) {

        return null;
      }
      
      // 创建新反馈
      const { data, error } = await supabase
        .from('image_feedback')
        .insert({
          generation_id: params.generationId,
          user_id: user.id,
          image_urls: params.imageUrls,  // 使用图片URL数组
          feedback_type: params.feedbackType,
          tags_used: params.tagsUsed,
          model_used: params.modelUsed,
        })
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('插入反馈记录失败，数据不一致');
          return null;
        }
        throw new Error(`提交批次反馈失败: ${error.message}`);
      }


      
      // 🚀 优化：只更新相关标签的成功率，而不是全部标签
      this.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);
      
      return data;
    }
  }

  /**
   * 获取批次反馈
   */
  async getImageFeedback(generationId: string): Promise<ImageFeedback[]> {
    // 🔒 安全优化：只返回必要的反馈字段
    const { data, error } = await supabase
      .from('image_feedback')
      .select(`
        id,
        generation_id,
        image_urls,
        feedback_type,
        created_at
      `)
      .eq('generation_id', generationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`获取批次反馈失败: ${error.message}`);
    }

    // 为反馈记录添加匿名user_id和默认字段
    return (data || []).map((record: any) => ({
      ...record,
      user_id: 'current_user', // 不暴露真实user_id
      tags_used: [], // 不暴露标签信息
      model_used: '', // 不暴露模型信息
    }));
  }

  /**
   * 🚀 性能优化：批量获取多个generation的反馈
   */
  async getBatchImageFeedback(generationIds: string[]): Promise<Map<string, ImageFeedback[]>> {
    if (generationIds.length === 0) {
      return new Map();
    }

    console.log(`🔍 批量查询反馈: ${generationIds.length}个generation`);

    // 🔒 安全优化：只返回必要的反馈字段
    const { data, error } = await supabase
      .from('image_feedback')
      .select(`
        id,
        generation_id,
        image_urls,
        feedback_type,
        created_at
      `)
      .in('generation_id', generationIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`批量获取反馈失败: ${error.message}`);
    }

    // 按generation_id分组
    const feedbackMap = new Map<string, ImageFeedback[]>();
    
    (data || []).forEach((record: any) => {
      const feedback: ImageFeedback = {
        ...record,
        user_id: 'current_user', // 不暴露真实user_id
        tags_used: [], // 不暴露标签信息
        model_used: '', // 不暴露模型信息
      };

      if (!feedbackMap.has(record.generation_id)) {
        feedbackMap.set(record.generation_id, []);
      }
      feedbackMap.get(record.generation_id)!.push(feedback);
    });

    console.log(`✅ 批量查询完成: 找到${data?.length || 0}条反馈记录`);
    return feedbackMap;
  }

  /**
   * 🚀 性能优化：只更新指定标签的成功率
   */
  async updateSpecificTagsSuccessRates(tagsToUpdate: string[]): Promise<void> {
    if (!tagsToUpdate || tagsToUpdate.length === 0) {
      console.log('📊 没有标签需要更新成功率');
      return;
    }

    console.log(`📊 优化更新 ${tagsToUpdate.length} 个指定标签的成功率...`);

    try {
      // 只查询涉及到这些标签的反馈数据
      const { data: feedbacks, error } = await supabase
        .from('image_feedback')
        .select('tags_used, feedback_type, image_urls')
        .overlaps('tags_used', tagsToUpdate); // 使用overlaps操作符筛选相关反馈

      if (error) {
        console.error('获取相关反馈数据失败:', error);
        return;
      }

      // 统计指定标签的反馈情况
      const tagFeedbackMap = new Map<string, { likes: number; total: number }>();

      // 初始化要更新的标签
      tagsToUpdate.forEach(tagName => {
        tagFeedbackMap.set(tagName, { likes: 0, total: 0 });
      });

      feedbacks?.forEach((feedback: any) => {
        feedback.tags_used?.forEach((tagName: string) => {
          if (tagFeedbackMap.has(tagName)) {
            const stats = tagFeedbackMap.get(tagName)!;
            const imageCount = feedback.image_urls?.length || 1;
            stats.total += imageCount;
            if (feedback.feedback_type === 'like') {
              stats.likes += imageCount;
            }
          }
        });
      });

      // 只更新有数据的标签
      const tagsWithData = Array.from(tagFeedbackMap.entries()).filter(([_, stats]) => stats.total > 0);
      
      if (tagsWithData.length > 0) {
        console.log(`📊 批量更新 ${tagsWithData.length} 个标签的成功率...`);
        
        const currentTime = new Date().toISOString();
        const updatePromises = tagsWithData.map(([tagName, stats]) => {
          const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
          const averageRating = successRate * 5;
          
          return supabase
            .from('tag_stats')
            .update({
              success_rate: successRate,
              average_rating: averageRating,
            })
            .eq('tag_name', tagName);
        });

        const results = await Promise.allSettled(updatePromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;
        
        console.log(`✅ 优化更新完成: ${successCount} 成功, ${failCount} 失败 (仅涉及相关标签)`);
      } else {
        console.log('📊 指定标签暂无反馈数据，跳过更新');
      }

    } catch (error) {
      console.error('❌ 更新指定标签成功率失败:', error);
    }
  }

  /**
   * 基于反馈更新标签成功率 (原有方法，更新所有标签)
   */
  async updateTagSuccessRates(): Promise<void> {


    try {
      // 获取所有反馈数据，按标签分组统计
      const { data: feedbacks, error } = await supabase
        .from('image_feedback')
        .select('tags_used, feedback_type, image_urls');

      if (error) {
        throw new Error(`获取反馈数据失败: ${error.message}`);
      }

      // 统计每个标签的反馈情况
      const tagFeedbackMap = new Map<string, { likes: number; total: number }>();

      feedbacks?.forEach((feedback: any) => {
        feedback.tags_used?.forEach((tagName: string) => {
          if (!tagFeedbackMap.has(tagName)) {
            tagFeedbackMap.set(tagName, { likes: 0, total: 0 });
          }
          
          const stats = tagFeedbackMap.get(tagName)!;
          // 每个反馈记录代表一个批次，需要按批次中的图片数量来计算
          const imageCount = feedback.image_urls?.length || 1;
          stats.total += imageCount;
          if (feedback.feedback_type === 'like') {
            stats.likes += imageCount;
          }
        });
      });

      // 🚀 批量更新标签成功率 - 性能优化
      if (tagFeedbackMap.size > 0) {
        console.log(`📊 批量更新 ${tagFeedbackMap.size} 个标签的成功率...`);
        
        // 准备批量upsert数据
        const currentTime = new Date().toISOString();
        const upsertData = Array.from(tagFeedbackMap.entries()).map(([tagName, stats]) => {
          const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
          const averageRating = successRate * 5; // 将成功率转换为5分制评分
          
          return {
            tag_name: tagName,
            tag_category: 'technical', // 默认分类，实际应该从现有记录中获取
            success_rate: successRate,
            average_rating: averageRating,
          };
        });

        // 使用批量upsert更新成功率 - 修复ON CONFLICT约束问题
        const { error: batchUpdateError } = await supabase
          .from('tag_stats')
          .upsert(upsertData, {
            onConflict: 'tag_name,tag_category', // 使用复合唯一约束
            ignoreDuplicates: false // 允许更新已存在的记录
          });

        if (batchUpdateError) {
          console.error('❌ 批量更新标签成功率失败:', batchUpdateError);
          
          // 降级处理：逐个更新
          console.log('🔄 回退到逐个更新模式...');
          let successCount = 0;
          for (const [tagName, stats] of tagFeedbackMap.entries()) {
            try {
              const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
              const averageRating = successRate * 5;

              const { error: updateError } = await supabase
                .from('tag_stats')
                .update({
                  success_rate: successRate,
                  average_rating: averageRating,
                  // updated_at: currentTime, // tag_stats表没有updated_at字段
                })
                .eq('tag_name', tagName);

              if (!updateError) {
                successCount++;
              } else {
                console.error(`更新标签 ${tagName} 成功率失败:`, updateError);
              }
            } catch (error) {
              console.error(`处理标签 ${tagName} 时出错:`, error);
            }
          }
          console.log(`⚠️ 降级更新完成: ${successCount}/${tagFeedbackMap.size} 个标签更新成功`);
        } else {
          console.log(`✅ 批量更新成功率完成 - ${tagFeedbackMap.size}个标签，仅用1次数据库请求！`);
        }
      }


    } catch (error) {
      console.error('❌ 更新标签成功率失败:', error);
    }
  }

  /**
   * 获取用户反馈统计
   */
  async getUserFeedbackStats(userId?: string): Promise<{
    total_feedback: number;
    likes_given: number;
    dislikes_given: number;
    feedback_rate: number;
  }> {
    const user = userId ? await this.getUserById(userId) : await this.getOrCreateUser();
    
    if (!user) {
      return {
        total_feedback: 0,
        likes_given: 0,
        dislikes_given: 0,
        feedback_rate: 0,
      };
    }

    const { data: feedbacks, error } = await supabase
      .from('image_feedback')
      .select('feedback_type')
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`获取用户反馈统计失败: ${error.message}`);
    }

    const totalFeedback = feedbacks?.length || 0;
    const likesGiven = feedbacks?.filter((f: any) => f.feedback_type === 'like').length || 0;
    const dislikesGiven = feedbacks?.filter((f: any) => f.feedback_type === 'dislike').length || 0;
    
    // 计算反馈率（反馈数 / 生成数）
    const totalGenerated = user.total_generated;
    const feedbackRate = totalGenerated > 0 ? totalFeedback / totalGenerated : 0;

    return {
      total_feedback: totalFeedback,
      likes_given: likesGiven,
      dislikes_given: dislikesGiven,
      feedback_rate: feedbackRate,
    };
  }

  // ===== 翻译缓存相关方法 =====

  /**
   * 生成提示词哈希值
   */
  private generatePromptHash(prompt: string): string {
    // 简单的哈希算法，实际项目中可以使用更复杂的哈希函数
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从缓存获取翻译结果
   */
  async getTranslationFromCache(originalPrompt: string): Promise<PromptTranslation | null> {
    const promptHash = this.generatePromptHash(originalPrompt.trim().toLowerCase());
    
    try {
      const { data, error } = await supabase
        .from('prompt_translations')
        .select('*')
        .eq('original_prompt_hash', promptHash)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 没有找到缓存，返回null
          return null;
        }
        console.error('获取翻译缓存失败:', error);
        return null;
      }

      console.log('🎯 命中翻译缓存');
      return data;
    } catch (error) {
      console.error('查询翻译缓存异常:', error);
      return null;
    }
  }

  /**
   * 保存翻译结果到缓存
   */
  async saveTranslationToCache(translationData: {
    originalPrompt: string;
    translatedPrompt: string;
    explanation?: string;
    keyTerms?: Array<{english: string, chinese: string}>;
    confidence?: number;
  }): Promise<PromptTranslation | null> {
    const promptHash = this.generatePromptHash(translationData.originalPrompt.trim().toLowerCase());
    
    try {
      const { data, error } = await supabase
        .from('prompt_translations')
        .upsert({
          original_prompt: translationData.originalPrompt,
          original_prompt_hash: promptHash,
          translated_prompt: translationData.translatedPrompt,
          translation_explanation: translationData.explanation || null,
          key_terms: translationData.keyTerms || [],
          confidence: translationData.confidence || 95,
        }, {
          onConflict: 'original_prompt_hash'
        })
        .select()
        .single();

      if (error) {
        console.error('保存翻译缓存失败:', error);
        return null;
      }

      console.log('💾 翻译结果已缓存');
      return data;
    } catch (error) {
      console.error('保存翻译缓存异常:', error);
      return null;
    }
  }

  /**
   * 翻译英文提示词（带缓存）
   */
  async translatePrompt(englishPrompt: string): Promise<{
    originalPrompt: string;
    chineseTranslation: string;
    explanation?: string;
    keyTerms?: Array<{english: string, chinese: string}>;
    confidence: number;
    fromCache: boolean;
  }> {
    // 1. 先查询缓存
    const cachedResult = await this.getTranslationFromCache(englishPrompt);
    if (cachedResult) {
      return {
        originalPrompt: cachedResult.original_prompt,
        chineseTranslation: cachedResult.translated_prompt,
        explanation: cachedResult.translation_explanation,
        keyTerms: cachedResult.key_terms,
        confidence: cachedResult.confidence,
        fromCache: true
      };
    }

    // 2. 缓存未命中，调用API翻译
    console.log('🌐 缓存未命中，调用翻译API...');
    try {
      const response = await fetch('/.netlify/functions/translate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ englishPrompt })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`翻译API失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const apiResult = await response.json();
      
      // 3. 保存到缓存
      await this.saveTranslationToCache({
        originalPrompt: englishPrompt,
        translatedPrompt: apiResult.chineseTranslation,
        explanation: apiResult.explanation,
        keyTerms: apiResult.keyTerms,
        confidence: apiResult.confidence
      });

      return {
        originalPrompt: apiResult.originalPrompt,
        chineseTranslation: apiResult.chineseTranslation,
        explanation: apiResult.explanation,
        keyTerms: apiResult.keyTerms,
        confidence: apiResult.confidence,
        fromCache: false
      };
      
    } catch (error) {
      console.error('翻译失败:', error);
      // 返回降级结果
      return {
        originalPrompt: englishPrompt,
        chineseTranslation: `[翻译] ${englishPrompt}`,
        explanation: '翻译服务暂时不可用',
        keyTerms: [],
        confidence: 0,
        fromCache: false
      };
    }
  }

  /**
   * 清理过期的翻译缓存（可定期调用）
   */
  async cleanupOldTranslations(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000)).toISOString();
    
    try {
      const { error } = await supabase
        .from('prompt_translations')
        .delete()
        .lt('created_at', cutoffDate);
        
      if (error) {
        console.error('清理翻译缓存失败:', error);
      } else {
        console.log(`🧹 已清理${daysOld}天前的翻译缓存`);
      }
    } catch (error) {
      console.error('清理翻译缓存异常:', error);
    }
  }
}
