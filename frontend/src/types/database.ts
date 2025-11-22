// ============================================
// 数据库表类型定义 v2.0
// ============================================

// ============================================
// 一、用户认证相关
// ============================================

// 认证提供商类型
export type AuthProvider = 'device' | 'google' | 'github';

// 核心用户表
export interface User {
  id: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  daily_quota: number;
  used_today: number;
  last_reset_date: string;
  total_generated: number;
  created_at: string;
  updated_at: string;
}

// 认证账号表
export interface AuthAccount {
  id: string;
  user_id: string;
  provider: AuthProvider;
  provider_user_id: string;      // 设备指纹或OAuth ID
  provider_email?: string;
  provider_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================
// 二、配置数据表
// ============================================

// 标签分类枚举
export type TagCategory =
  | 'art_style'           // 艺术风格组
  | 'theme_style'         // 主题风格组
  | 'mood'                // 情绪氛围组
  | 'technical'           // 技术参数组
  | 'composition'         // 构图参数组
  | 'enhancement'         // 增强属性组
  | 'subject_suggestion'; // 主题建议组

// 标签定义表（数据库版本）
export interface TagRecord {
  id: string;
  category: TagCategory;
  label: string;              // 中文标签名
  value: string;              // 英文提示词值
  display_value?: string;     // 详细中文描述
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// 模板难度等级
export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';

// 模板状态
export type TemplateStatus = 'active' | 'draft' | 'archived';

// 场景模板表（数据库驱动版本）
export interface SceneTemplate {
  id: string;
  name: string;                       // 模板名称
  name_en?: string;                   // 英文名称（用于国际化）
  icon?: string;                      // 图标（emoji或图标名称）
  description?: string;               // 模板描述
  category: string;                   // 主分类（如：portrait, landscape, product等）
  subcategory?: string;               // 子分类
  tags: string[];                     // 标签数组
  difficulty: TemplateDifficulty;     // 难度等级
  base_prompt: string;                // 基础提示词
  suggested_tags?: {                  // 建议的标签配置
    art_style?: string[];
    theme_style?: string[];
    mood?: string[];
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
  };
  thumbnail_url?: string;             // 缩略图URL
  example_images: string[];           // 示例图片URL数组
  examples?: string[];                // 示例描述数组
  tips?: string;                      // 使用提示
  recommended_model?: string;         // 推荐AI模型
  recommended_aspect_ratio?: string;  // 推荐宽高比
  recommended_steps?: number;         // 推荐推理步数
  recommended_output_format?: string; // 推荐输出格式
  recommended_num_outputs?: number;   // 推荐输出数量
  usage_count: number;                // 使用次数
  rating: number;                     // 平均评分（0-5）
  likes_count: number;                // 点赞数
  author_id?: string;                 // 创建者ID（关联users表）
  is_official: boolean;               // 是否官方模板
  is_public: boolean;                 // 是否公开
  status: TemplateStatus;             // 状态
  created_at: string;
  updated_at: string;
}

// 用户模板收藏表
export interface UserTemplateFavorite {
  id: string;
  user_id: string;                    // 用户ID
  template_id: string;                // 模板ID
  notes?: string;                     // 用户备注
  created_at: string;
}

// 模板评分表
export interface TemplateRating {
  id: string;
  template_id: string;                // 模板ID
  user_id: string;                    // 用户ID
  rating: number;                     // 评分（1-5）
  review?: string;                    // 评价文字
  helpful_count: number;              // 有用计数
  created_at: string;
  updated_at: string;
}

// 模板使用历史表
export interface TemplateUsageHistory {
  id: string;
  template_id: string;                // 模板ID
  user_id: string;                    // 用户ID
  generation_id?: string;             // 关联的生成记录ID
  custom_modifications?: string;      // 用户的自定义修改
  was_successful: boolean;            // 生成是否成功
  user_rating?: number;               // 用户对此次使用的评分
  created_at: string;
}

// AI模型配置表
export interface AIModelConfig {
  id: string;                         // 'flux-schnell'
  name: string;                       // 'black-forest-labs'
  description?: string;
  provider: string;                   // 'replicate'
  cost_per_generation: number;
  runs_number?: string;               // '392.8M'
  tags: string[];                     // ['超快', '经济', '推荐']
  default_config: {
    numInferenceSteps?: number;
    aspectRatio?: string;
    outputFormat?: string;
    numOutputs?: number;
    [key: string]: any;
  };
  capabilities: {
    supportsAspectRatio?: boolean;
    maxSteps?: number;
    maxOutputs?: number;
    supportedFormats?: string[];
    [key: string]: any;
  };
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 三、业务数据表
// ============================================

// 生成记录表
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
  // R2存储相关字段
  original_image_urls?: string[];
  r2_keys?: string[];
  r2_data?: any;
  // 标签数据
  tags_used?: Array<{name: string, category: TagCategory, value: string}>;
  // 推荐系统相关字段
  view_count: number;
  like_count: number;
  share_count: number;
  is_featured: boolean;
}

// 提示词统计表
export interface PromptStats {
  id: string;
  prompt_text: string;
  usage_count: number;
  last_used: string;
  average_rating: number;
}

// 每日统计表
export interface DailyStats {
  id: string;
  date: string;
  total_generations: number;
  total_users: number;
  total_cost: number;
  popular_prompts: string[];
}

// 标签统计表
export interface TagStats {
  id: string;
  tag_name: string;
  tag_category: TagCategory;
  tag_value: string;
  usage_count: number;
  success_rate: number;
  average_rating: number;
  last_used: string;
  created_at: string;
  updated_at: string;
}

// 图片反馈表
export interface ImageFeedback {
  id: string;
  generation_id: string;
  user_id: string;
  image_urls: string[];
  feedback_type: FeedbackType;
  tags_used: string[];
  model_used: string;
  created_at: string;
}

// 反馈类型枚举
export type FeedbackType = 'like' | 'dislike' | null;

// 翻译缓存表
export interface PromptTranslation {
  id: string;
  original_prompt: string;
  original_prompt_hash: string;
  translated_prompt: string;
  translation_explanation?: string;
  key_terms: Array<{english: string, chinese: string}>;
  confidence: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 四、推荐系统相关
// ============================================

// 用户行为事件类型
export type UserEventType = 'view' | 'generate' | 'like' | 'dislike' | 'download' | 'share' | 'copy_prompt';

// 事件目标类型
export type EventTargetType = 'generation' | 'tag' | 'template' | 'model';

// 用户行为事件表
export interface UserEvent {
  id: string;
  user_id: string;
  event_type: UserEventType;
  target_type: EventTargetType;
  target_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// 用户偏好类型
export type PreferenceType = 'tag_category' | 'model' | 'style';

// 用户偏好画像表
export interface UserPreference {
  id: string;
  user_id: string;
  preference_type: PreferenceType;
  preference_key: string;         // 'art_style:cyberpunk' | 'flux-schnell'
  score: number;
  interaction_count: number;
  last_interaction: string;
  updated_at: string;
}

// 推荐类型
export type RecommendationType = 'tag' | 'template' | 'prompt' | 'generation';

// 推荐算法类型
export type RecommendationAlgorithm = 'popularity' | 'content_based' | 'collaborative' | 'hybrid';

// 推荐记录表
export interface Recommendation {
  id: string;
  user_id: string;
  recommendation_type: RecommendationType;
  recommended_items: any[];
  algorithm: RecommendationAlgorithm;
  context?: Record<string, any>;
  created_at: string;
}

// 推荐交互动作
export type RecommendationAction = 'click' | 'adopt' | 'ignore' | 'dismiss';

// 推荐交互表
export interface RecommendationInteraction {
  id: string;
  recommendation_id: string;
  user_id: string;
  item_id: string;
  action: RecommendationAction;
  position?: number;
  created_at: string;
}

// 实验状态
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

// 实验变体
export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
}

// 实验配置表
export interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  target_metric: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

// 用户实验分组表
export interface UserExperimentAssignment {
  id: string;
  user_id: string;
  experiment_id: string;
  variant_id: string;
  assigned_at: string;
}

// 热门内容时间段
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

// 热门内容类型
export type PopularItemType = 'generation' | 'tag_combo' | 'prompt' | 'model';

// 热门内容表
export interface PopularItem {
  id: string;
  item_type: PopularItemType;
  item_id: string;
  item_data?: Record<string, any>;
  score: number;
  time_period: TimePeriod;
  rank?: number;
  calculated_at: string;
}

// ============================================
// 五、辅助类型
// ============================================

// 用户使用统计
export interface UserUsageStats {
  daily: {
    used: number;
    limit: number;
    remaining: number;
  };
  total: {
    generated: number;
    cost: number;
    likes_received: number;
    dislikes_received: number;
    feedback_given: number;
  };
}

// 标签推荐数据
export interface TagRecommendation {
  tag: TagStats;
  score: number;
  reason: string;
}

// 热门标签分析数据
export interface PopularTagsAnalysis {
  category: TagCategory;
  tags: TagStats[];
  total_usage: number;
  growth_rate: number;
}

// ============================================
// Supabase Database 类型
// ============================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      auth_accounts: {
        Row: AuthAccount;
        Insert: Omit<AuthAccount, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AuthAccount, 'id' | 'created_at'>>;
      };
      tags: {
        Row: TagRecord;
        Insert: Omit<TagRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TagRecord, 'id' | 'created_at'>>;
      };
      scene_templates: {
        Row: SceneTemplate;
        Insert: Omit<SceneTemplate, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SceneTemplate, 'id' | 'created_at'>>;
      };
      user_template_favorites: {
        Row: UserTemplateFavorite;
        Insert: Omit<UserTemplateFavorite, 'id' | 'created_at'>;
        Update: Partial<Omit<UserTemplateFavorite, 'id' | 'created_at'>>;
      };
      template_ratings: {
        Row: TemplateRating;
        Insert: Omit<TemplateRating, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TemplateRating, 'id' | 'created_at'>>;
      };
      template_usage_history: {
        Row: TemplateUsageHistory;
        Insert: Omit<TemplateUsageHistory, 'id' | 'created_at'>;
        Update: Partial<Omit<TemplateUsageHistory, 'id' | 'created_at'>>;
      };
      ai_models: {
        Row: AIModelConfig;
        Insert: Omit<AIModelConfig, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AIModelConfig, 'created_at'>>;
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
      prompt_translations: {
        Row: PromptTranslation;
        Insert: Omit<PromptTranslation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PromptTranslation, 'id' | 'created_at'>>;
      };
      user_events: {
        Row: UserEvent;
        Insert: Omit<UserEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<UserEvent, 'id' | 'created_at'>>;
      };
      user_preferences: {
        Row: UserPreference;
        Insert: Omit<UserPreference, 'id' | 'updated_at'>;
        Update: Partial<Omit<UserPreference, 'id'>>;
      };
      recommendations: {
        Row: Recommendation;
        Insert: Omit<Recommendation, 'id' | 'created_at'>;
        Update: Partial<Omit<Recommendation, 'id' | 'created_at'>>;
      };
      recommendation_interactions: {
        Row: RecommendationInteraction;
        Insert: Omit<RecommendationInteraction, 'id' | 'created_at'>;
        Update: Partial<Omit<RecommendationInteraction, 'id' | 'created_at'>>;
      };
      experiments: {
        Row: Experiment;
        Insert: Omit<Experiment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Experiment, 'id' | 'created_at'>>;
      };
      user_experiment_assignments: {
        Row: UserExperimentAssignment;
        Insert: Omit<UserExperimentAssignment, 'id' | 'assigned_at'>;
        Update: Partial<Omit<UserExperimentAssignment, 'id' | 'assigned_at'>>;
      };
      popular_items: {
        Row: PopularItem;
        Insert: Omit<PopularItem, 'id' | 'calculated_at'>;
        Update: Partial<Omit<PopularItem, 'id'>>;
      };
    };
  };
}
