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
  PopularTagsAnalysis
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
    
    // 🔒 安全优化：只查询必要的字段
    const { data: feedbackStats } = await supabase
      .from('image_feedback')
      .select('feedback_type')
      .eq('user_id', user.id);

    const likesReceived = feedbackStats?.filter(f => f.feedback_type === 'like').length || 0;
    const dislikesReceived = feedbackStats?.filter(f => f.feedback_type === 'dislike').length || 0;
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

    // 🔒 安全优化：只查询必要字段，不暴露敏感信息
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
        r2_data
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

    // 获取分页数据
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
        r2_data
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
    // 🔒 安全优化：公开画廊不暴露用户敏感信息，使用匿名user_id
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
        r2_data
      `)
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`获取公开生成记录失败: ${error.message}`);
    }

    // 为公开记录添加匿名user_id和默认model_cost
    return (data || []).map(record => ({
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

    // 获取分页数据
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
        r2_data
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
    const mappedData = (data || []).map(record => ({
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
    const completedGenerations = generationsToday?.filter(r => r.status === 'completed') || [];

    // 统计今日活跃用户（有生成行为的用户）
    const uniqueUserIds = new Set(completedGenerations.map(gen => gen.user_id));
    
    const totalGenerations = completedGenerations.length;
    const totalActiveUsers = uniqueUserIds.size;
    const totalCost = completedGenerations.reduce((sum, gen) => sum + (gen.model_cost || 0), 0);

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
      完成记录数: data?.filter(r => r.status === 'completed').length || 0,
      失败记录数: data?.filter(r => r.status === 'failed').length || 0,
      待处理记录数: data?.filter(r => r.status === 'pending').length || 0,
    });

    // 详细分析每条记录
    data?.forEach((record, index) => {
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
    allStats.forEach(stat => {
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
   * 记录标签使用统计 - 性能优化版本
   */
  async updateTagStats(tags: Array<{name: string, category: TagCategory, value: string}>): Promise<void> {
    if (!tags || tags.length === 0) {
      return;
    }

    console.log('📊 批量更新标签使用统计:', tags.length, '个标签');

    try {
      // 🚀 性能优化1：批量查询现有标签，减少数据库请求次数
      // 先按分类分组，然后分别查询（避免复杂的OR条件）
      const tagsByCategory = new Map<TagCategory, string[]>();
      tags.forEach(tag => {
        if (!tagsByCategory.has(tag.category)) {
          tagsByCategory.set(tag.category, []);
        }
        tagsByCategory.get(tag.category)!.push(tag.name);
      });

      // 分类别并行查询，然后合并结果
      const existingTagsPromises = Array.from(tagsByCategory.entries()).map(([category, tagNames]) =>
        supabase
          .from('tag_stats')
          .select('*')
          .eq('tag_category', category)
          .in('tag_name', tagNames)
      );

      const existingTagsResults = await Promise.all(existingTagsPromises);
      
      // 检查是否有查询错误
      const fetchError = existingTagsResults.find((result: any) => result.error)?.error;
      if (fetchError) {
        console.error('批量获取标签统计失败:', fetchError);
        return;
      }

      // 合并所有查询结果
      const existingTags = existingTagsResults.flatMap((result: any) => result.data || []);

      // 🚀 性能优化2：建立现有标签的映射表
      const existingTagsMap = new Map<string, any>();
      (existingTags || []).forEach((tag: any) => {
        const key = `${tag.tag_name}_${tag.tag_category}`;
        existingTagsMap.set(key, tag);
      });

      // 🚀 性能优化3：分离更新和插入操作
      const toUpdate: Array<{id: string, usage_count: number}> = [];
      const toInsert: Array<any> = [];
      const currentTime = new Date().toISOString();

      tags.forEach(tag => {
        const key = `${tag.name}_${tag.category}`;
        const existing = existingTagsMap.get(key);
        
        if (existing) {
          // 需要更新的记录
          toUpdate.push({
            id: existing.id,
            usage_count: existing.usage_count + 1
          });
        } else {
          // 需要插入的记录
          toInsert.push({
            tag_name: tag.name,
            tag_category: tag.category,
            tag_value: tag.value,
            usage_count: 1,
            success_rate: 0,
            average_rating: 0,
            last_used: currentTime,
          });
        }
      });

      // 🚀 性能优化4：批量执行更新操作
      const promises: Promise<void>[] = [];

      // 批量插入新标签
      if (toInsert.length > 0) {
        console.log(`📝 批量插入 ${toInsert.length} 个新标签`);
        const insertPromise = supabase
          .from('tag_stats')
          .insert(toInsert)
          .then((result: any) => {
            if (result.error) {
              console.error('批量插入标签失败:', result.error);
            } else {
              console.log(`✅ 成功插入 ${toInsert.length} 个标签`);
            }
          });
        promises.push(insertPromise);
      }

      // 批量更新现有标签 - 并行执行多个更新
      if (toUpdate.length > 0) {
        console.log(`🔄 批量更新 ${toUpdate.length} 个现有标签`);
        // Supabase不支持真正的批量更新，所以我们并行执行多个更新
        const updatePromises = toUpdate.map((update: any) => 
          supabase
            .from('tag_stats')
            .update({
              usage_count: update.usage_count,
              last_used: currentTime,
              updated_at: currentTime,
            })
            .eq('id', update.id)
        );

        const updateAllPromise = Promise.allSettled(updatePromises).then((results) => {
          const successCount = results.filter((r) => r.status === 'fulfilled').length;
          const failCount = results.filter((r) => r.status === 'rejected').length;
          console.log(`✅ 标签更新完成: ${successCount} 成功, ${failCount} 失败`);
          
          if (failCount > 0) {
            const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
            failures.forEach((failure, index) => {
              console.error(`标签更新失败 [${toUpdate[index]?.id}]:`, failure.reason);
            });
          }
        });
        promises.push(updateAllPromise);
      }

      // 🚀 性能优化5：并行执行所有数据库操作
      await Promise.all(promises);
      
      console.log(`✅ 标签统计更新完成 - 优化后总请求数: ${promises.length} (原来需要: ${tags.length * 2})`);

    } catch (error) {
      console.error('批量更新标签统计失败:', error);
      // 降级处理：如果批量更新失败，回退到原来的逐个处理方式
      console.log('🔄 回退到逐个更新模式...');
      await this.updateTagStatsLegacy(tags);
    }
  }

  /**
   * 标签统计更新的降级方法（保留原逻辑作为备用）
   */
  private async updateTagStatsLegacy(tags: Array<{name: string, category: TagCategory, value: string}>): Promise<void> {
    for (const tag of tags) {
      try {
        // 使用upsert操作减少查询次数
        const { error } = await supabase
          .from('tag_stats')
          .upsert({
            tag_name: tag.name,
            tag_category: tag.category,
            tag_value: tag.value,
            usage_count: 1, // 这里会有问题，无法正确累加，但作为降级方案可以接受
            success_rate: 0,
            average_rating: 0,
            last_used: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tag_name,tag_category',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`降级更新标签统计失败 [${tag.name}]:`, error);
        }
      } catch (error) {
        console.error(`降级处理标签统计失败 [${tag.name}]:`, error);
      }
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
      .filter(tag => !usedTags.includes(tag.tag_name))
      .slice(0, limit)
      .map(tag => {
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
      .sort((a, b) => b.score - a.score);

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

      const totalUsage = (data || []).reduce((sum, tag) => sum + tag.usage_count, 0);
      
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

    // 检查是否已经对这个批次提交过反馈
    const { data: existing, error: checkError } = await supabase
      .from('image_feedback')
      .select('*')
      .eq('generation_id', params.generationId)
      .eq('user_id', user.id)
      .single();

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


        
        // 异步更新标签成功率
        this.updateTagSuccessRates().catch(console.error);
        
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
          throw new Error(`更新批次反馈失败: ${error.message}`);
        }


        
        // 异步更新标签成功率
        this.updateTagSuccessRates().catch(console.error);
        
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
        throw new Error(`提交批次反馈失败: ${error.message}`);
      }


      
      // 异步更新标签成功率
      this.updateTagSuccessRates().catch(console.error);
      
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
    return (data || []).map(record => ({
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
    
    (data || []).forEach(record => {
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
   * 基于反馈更新标签成功率
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

      feedbacks?.forEach(feedback => {
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

      // 更新每个标签的成功率
      for (const [tagName, stats] of tagFeedbackMap.entries()) {
        const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
        const averageRating = successRate * 5; // 将成功率转换为5分制评分

        const { error: updateError } = await supabase
          .from('tag_stats')
          .update({
            success_rate: successRate,
            average_rating: averageRating,
            updated_at: new Date().toISOString(),
          })
          .eq('tag_name', tagName);

        if (updateError) {
          console.error(`更新标签 ${tagName} 成功率失败:`, updateError);
        } else {

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
    const likesGiven = feedbacks?.filter(f => f.feedback_type === 'like').length || 0;
    const dislikesGiven = feedbacks?.filter(f => f.feedback_type === 'dislike').length || 0;
    
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
}
