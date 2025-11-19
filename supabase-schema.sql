-- Prism AI Generator 数据库 Schema
-- 在 Supabase SQL Editor 中执行此脚本创建所有表

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint TEXT UNIQUE NOT NULL,
  daily_quota INTEGER DEFAULT 10,
  used_today INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  total_generated INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 生成记录表
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_cost DECIMAL(10, 4) DEFAULT 0,
  image_urls TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_public BOOLEAN DEFAULT false,
  -- R2存储相关字段
  original_image_urls TEXT[],
  r2_keys TEXT[],
  r2_data JSONB,
  -- 标签数据
  tags_used JSONB
);

-- 3. 提示词统计表
CREATE TABLE IF NOT EXISTS prompt_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  average_rating DECIMAL(3, 2) DEFAULT 0
);

-- 4. 每日统计表
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  total_generations INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  popular_prompts TEXT[] DEFAULT '{}'
);

-- 5. 标签统计表
CREATE TABLE IF NOT EXISTS tag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  tag_category TEXT NOT NULL CHECK (tag_category IN ('art_style', 'theme_style', 'mood', 'technical', 'composition', 'enhancement')),
  tag_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_name, tag_category)
);

-- 6. 图片反馈表
CREATE TABLE IF NOT EXISTS image_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_urls TEXT[] DEFAULT '{}',
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike')),
  tags_used TEXT[] DEFAULT '{}',
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 翻译缓存表
CREATE TABLE IF NOT EXISTS prompt_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_prompt TEXT NOT NULL,
  original_prompt_hash TEXT UNIQUE NOT NULL,
  translated_prompt TEXT NOT NULL,
  translation_explanation TEXT,
  key_terms JSONB DEFAULT '[]',
  confidence DECIMAL(3, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_last_reset_date ON users(last_reset_date);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);

CREATE INDEX IF NOT EXISTS idx_tag_stats_category ON tag_stats(tag_category);
CREATE INDEX IF NOT EXISTS idx_tag_stats_usage ON tag_stats(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_image_feedback_generation ON image_feedback(generation_id);
CREATE INDEX IF NOT EXISTS idx_image_feedback_user ON image_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_prompt_translations_hash ON prompt_translations(original_prompt_hash);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);

-- 启用 Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_translations ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略 (允许匿名访问，因为使用设备指纹而非用户认证)
-- 用户表：允许所有操作
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true) WITH CHECK (true);

-- 生成记录表：允许所有操作
CREATE POLICY "Allow all operations on generations" ON generations FOR ALL USING (true) WITH CHECK (true);

-- 提示词统计表：允许所有操作
CREATE POLICY "Allow all operations on prompt_stats" ON prompt_stats FOR ALL USING (true) WITH CHECK (true);

-- 每日统计表：允许所有操作
CREATE POLICY "Allow all operations on daily_stats" ON daily_stats FOR ALL USING (true) WITH CHECK (true);

-- 标签统计表：允许所有操作
CREATE POLICY "Allow all operations on tag_stats" ON tag_stats FOR ALL USING (true) WITH CHECK (true);

-- 图片反馈表：允许所有操作
CREATE POLICY "Allow all operations on image_feedback" ON image_feedback FOR ALL USING (true) WITH CHECK (true);

-- 翻译缓存表：允许所有操作
CREATE POLICY "Allow all operations on prompt_translations" ON prompt_translations FOR ALL USING (true) WITH CHECK (true);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间戳触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tag_stats_updated_at BEFORE UPDATE ON tag_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_translations_updated_at BEFORE UPDATE ON prompt_translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
