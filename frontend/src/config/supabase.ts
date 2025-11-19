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
    // 启用自动刷新 token
    autoRefreshToken: true,
    // 持久化 session 到 localStorage
    persistSession: true,
    // 检测 URL 中的 session
    detectSessionInUrl: true,
    // 存储 key
    storageKey: 'prism-ai-auth',
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