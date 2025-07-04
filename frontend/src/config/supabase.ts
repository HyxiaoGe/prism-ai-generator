import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// 环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建Supabase客户端
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 禁用自动刷新，因为我们使用匿名访问
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    // 禁用实时功能以节省资源
    params: {
      eventsPerSecond: 0,
    },
  },
});

// 导出类型
export type { Database } from '../types/database'; 