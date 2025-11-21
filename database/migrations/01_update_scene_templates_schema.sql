-- ==============================================
-- 场景模板表结构更新迁移脚本
-- 从旧版本迁移到新版本（v2.0）
-- ==============================================

-- 步骤1：删除旧表的所有数据（保留表结构）
TRUNCATE TABLE scene_templates CASCADE;

-- 步骤2：删除旧表（因为字段变化太大，直接重建更简单）
DROP TABLE IF EXISTS scene_templates CASCADE;

-- 步骤3：删除相关的关联表（如果存在）
DROP TABLE IF EXISTS user_template_favorites CASCADE;
DROP TABLE IF EXISTS template_ratings CASCADE;
DROP TABLE IF EXISTS template_usage_history CASCADE;

-- 步骤4：创建新版本的 scene_templates 表
CREATE TABLE scene_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  name TEXT NOT NULL,                             -- 模板名称：'专业人像摄影'
  description TEXT,                               -- 模板描述：'适合拍摄高质量人像照片'

  -- 分类信息
  category TEXT NOT NULL,                         -- 主分类：'摄影艺术', 'anime', 'game' 等
  subcategory TEXT,                               -- 子分类：'人像摄影', 'character' 等
  tags TEXT[] DEFAULT '{}',                       -- 标签数组：['人像','摄影','专业']

  -- 难度和属性
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  -- 提示词相关
  base_prompt TEXT NOT NULL,                      -- 基础提示词
  suggested_tags JSONB,                           -- 推荐的标签配置 {"mood":[],"artStyle":[],...}

  -- 媒体资源
  thumbnail_url TEXT,                             -- 缩略图URL
  example_images TEXT[] DEFAULT '{}',             -- 示例图片URL数组

  -- 统计信息
  usage_count INTEGER DEFAULT 0,                  -- 使用次数
  rating DECIMAL(3, 2) DEFAULT 0.00,             -- 平均评分 (0.00-5.00)
  likes_count INTEGER DEFAULT 0,                  -- 点赞数

  -- 作者和权限
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- 作者ID（NULL表示系统模板）
  is_official BOOLEAN DEFAULT false,              -- 是否官方模板
  is_public BOOLEAN DEFAULT true,                 -- 是否公开

  -- 状态
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 步骤5：创建模板收藏表
CREATE TABLE user_template_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES scene_templates(id) ON DELETE CASCADE,
  notes TEXT,                                     -- 收藏备注
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_id)                    -- 每个用户只能收藏一次
);

-- 步骤6：创建模板评分表
CREATE TABLE template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES scene_templates(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),  -- 1-5星
  review TEXT,                                    -- 评价内容
  helpful_count INTEGER DEFAULT 0,                -- 有用投票数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_id)                    -- 每个用户只能评分一次
);

-- 步骤7：创建模板使用历史表
CREATE TABLE template_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES scene_templates(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,  -- 关联的生成记录
  custom_modifications TEXT,                      -- 用户的自定义修改
  was_successful BOOLEAN DEFAULT true,            -- 生成是否成功
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),  -- 使用后评分
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 步骤8：创建索引以提升查询性能
CREATE INDEX idx_scene_templates_category ON scene_templates(category);
CREATE INDEX idx_scene_templates_difficulty ON scene_templates(difficulty);
CREATE INDEX idx_scene_templates_status ON scene_templates(status);
CREATE INDEX idx_scene_templates_is_official ON scene_templates(is_official);
CREATE INDEX idx_scene_templates_rating ON scene_templates(rating DESC);
CREATE INDEX idx_scene_templates_usage_count ON scene_templates(usage_count DESC);

CREATE INDEX idx_user_template_favorites_user_id ON user_template_favorites(user_id);
CREATE INDEX idx_user_template_favorites_template_id ON user_template_favorites(template_id);

CREATE INDEX idx_template_ratings_template_id ON template_ratings(template_id);
CREATE INDEX idx_template_ratings_rating ON template_ratings(rating DESC);

CREATE INDEX idx_template_usage_history_user_id ON template_usage_history(user_id);
CREATE INDEX idx_template_usage_history_template_id ON template_usage_history(template_id);

-- 步骤9：创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scene_templates_updated_at
  BEFORE UPDATE ON scene_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_ratings_updated_at
  BEFORE UPDATE ON template_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 步骤10：启用行级安全 (RLS)
ALTER TABLE scene_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_history ENABLE ROW LEVEL SECURITY;

-- 步骤11：创建RLS策略（允许所有操作 - 可根据需求调整）
CREATE POLICY "Allow all on scene_templates"
  ON scene_templates FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on user_template_favorites"
  ON user_template_favorites FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on template_ratings"
  ON template_ratings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on template_usage_history"
  ON template_usage_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- 迁移完成！
-- 现在可以运行 add_more_templates.sql 插入数据
-- ==============================================
