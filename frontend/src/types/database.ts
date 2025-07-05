// 数据库表类型定义
export interface User {
  id: string;
  device_fingerprint: string;
  daily_quota: number;
  used_today: number;
  last_reset_date: string;
  total_generated: number;
  created_at: string;
  updated_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  prompt: string;
  model_name: string;
  model_cost: number;
  image_urls: string[];
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  is_public: boolean;
}

export interface PromptStats {
  id: string;
  prompt_text: string;
  usage_count: number;
  last_used: string;
  average_rating: number;
}

export interface DailyStats {
  id: string;
  date: string;
  total_generations: number;
  total_users: number;
  total_cost: number;
  popular_prompts: string[];
}

// 新增：标签统计表
export interface TagStats {
  id: string;
  tag_name: string;              // 标签显示名称，如 "摄影级逼真"
  tag_category: TagCategory;      // 标签分类
  tag_value: string;             // 标签实际值，如 "photorealistic, hyperrealistic..."
  usage_count: number;           // 使用次数
  success_rate: number;          // 成功率（基于反馈计算）
  average_rating: number;        // 平均评分（基于反馈计算）
  last_used: string;            // 最后使用时间
  created_at: string;
  updated_at: string;
}

// 标签分类枚举
export type TagCategory = 
  | 'art_style'        // 艺术风格组
  | 'theme_style'      // 主题风格组  
  | 'mood'             // 情绪氛围组
  | 'technical'        // 技术参数组
  | 'composition'      // 构图参数组
  | 'enhancement'      // 增强属性组
  | 'negative';        // 负面提示词组

// 新增：图片反馈表
export interface ImageFeedback {
  id: string;
  generation_id: string;        // 关联 generations 表
  user_id: string;             // 关联 users 表
  image_urls: string[];        // 批次中所有图片的URL数组
  feedback_type: FeedbackType; // 反馈类型
  tags_used: string[];         // 生成时使用的标签（用于分析标签效果）
  model_used: string;          // 使用的模型（用于分析模型效果）
  created_at: string;
}

// 反馈类型枚举
export type FeedbackType = 'like' | 'dislike' | null;

// 扩展用户使用统计，增加反馈统计
export interface UserUsageStats {
  daily: {
    used: number;
    limit: number;
    remaining: number;
  };
  total: {
    generated: number;
    cost: number;
    likes_received: number;      // 新增：获得的点赞数
    dislikes_received: number;   // 新增：获得的不喜欢数
    feedback_given: number;      // 新增：给出的反馈数
  };
}

// 新增：标签推荐数据
export interface TagRecommendation {
  tag: TagStats;
  score: number;              // 推荐分数
  reason: string;             // 推荐原因
}

// 新增：热门标签分析数据
export interface PopularTagsAnalysis {
  category: TagCategory;
  tags: TagStats[];
  total_usage: number;
  growth_rate: number;        // 增长率
}

// Supabase Database类型
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      generations: {
        Row: Generation;
        Insert: Omit<Generation, 'id' | 'created_at'>;
        Update: Partial<Omit<Generation, 'id' | 'created_at'>>;
      };
      prompt_stats: {
        Row: PromptStats;
        Insert: Omit<PromptStats, 'id'>;
        Update: Partial<Omit<PromptStats, 'id'>>;
      };
      daily_stats: {
        Row: DailyStats;
        Insert: Omit<DailyStats, 'id'>;
        Update: Partial<Omit<DailyStats, 'id'>>;
      };
      tag_stats: {
        Row: TagStats;
        Insert: Omit<TagStats, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TagStats, 'id' | 'created_at'>>;
      };
      image_feedback: {
        Row: ImageFeedback;
        Insert: Omit<ImageFeedback, 'id' | 'created_at'>;
        Update: Partial<Omit<ImageFeedback, 'id' | 'created_at'>>;
      };
    };
  };
} 