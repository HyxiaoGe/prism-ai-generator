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
    };
  };
}

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
  };
} 