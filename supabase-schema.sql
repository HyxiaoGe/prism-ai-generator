-- ============================================
-- Prism AI Generator 数据库 Schema v2.0
-- 在 Supabase SQL Editor 中执行此脚本创建所有表
-- ============================================

-- ============================================
-- 一、用户认证相关
-- ============================================

-- 1. 核心用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT,                              -- 显示名称
  email TEXT,                                     -- 邮箱（可选）
  avatar_url TEXT,                                -- 头像URL
  daily_quota INTEGER DEFAULT 10,                 -- 每日配额
  used_today INTEGER DEFAULT 0,                   -- 今日已用
  last_reset_date DATE DEFAULT CURRENT_DATE,     -- 配额重置日期
  total_generated INTEGER DEFAULT 0,              -- 累计生成数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 认证账号表（支持多种登录方式）
CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                         -- 'device' | 'google' | 'github'
  provider_user_id TEXT NOT NULL,                 -- 提供商返回的用户ID（设备指纹或OAuth ID）
  provider_email TEXT,                            -- 提供商邮箱
  provider_data JSONB,                            -- 提供商返回的原始数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- ============================================
-- 二、配置数据表（硬编码 -> 数据库）
-- ============================================

-- 3. 标签定义表
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                         -- 'art_style' | 'theme_style' | 'mood' | 'technical' | 'composition' | 'enhancement' | 'subject_suggestion'
  label TEXT NOT NULL,                            -- 中文标签名：'摄影级逼真'
  value TEXT NOT NULL,                            -- 英文提示词值
  display_value TEXT,                             -- 详细中文描述
  sort_order INTEGER DEFAULT 0,                   -- 排序顺序
  is_enabled BOOLEAN DEFAULT true,                -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 场景模板表
CREATE TABLE IF NOT EXISTS scene_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,                            -- '人像摄影'
  prompt TEXT NOT NULL,                           -- 基础提示词
  technical TEXT,                                 -- 技术参数
  lighting TEXT,                                  -- 光线设置
  mood TEXT,                                      -- 情绪氛围
  sort_order INTEGER DEFAULT 0,                   -- 排序顺序
  is_enabled BOOLEAN DEFAULT true,                -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AI模型配置表
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,                            -- 'flux-schnell'
  name TEXT NOT NULL,                             -- 'black-forest-labs'
  description TEXT,                               -- 模型描述
  provider TEXT NOT NULL,                         -- 'replicate'
  cost_per_generation DECIMAL(10, 6) DEFAULT 0,   -- 单次生成成本
  runs_number TEXT,                               -- 运行次数：'392.8M'
  tags TEXT[] DEFAULT '{}',                       -- ['超快', '经济', '推荐']
  default_config JSONB,                           -- 默认配置
  capabilities JSONB,                             -- 能力配置
  is_enabled BOOLEAN DEFAULT true,                -- 是否启用
  sort_order INTEGER DEFAULT 0,                   -- 排序顺序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 三、业务数据表
-- ============================================

-- 6. 生成记录表
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
  tags_used JSONB,
  -- 推荐系统相关字段
  view_count INTEGER DEFAULT 0,                   -- 浏览次数
  like_count INTEGER DEFAULT 0,                   -- 点赞数（冗余，便于排序）
  share_count INTEGER DEFAULT 0,                  -- 分享次数
  is_featured BOOLEAN DEFAULT false               -- 是否精选
);

-- 7. 提示词统计表
CREATE TABLE IF NOT EXISTS prompt_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  average_rating DECIMAL(3, 2) DEFAULT 0
);

-- 8. 每日统计表
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  total_generations INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  popular_prompts TEXT[] DEFAULT '{}'
);

-- 9. 标签统计表
CREATE TABLE IF NOT EXISTS tag_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  tag_category TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_name, tag_category)
);

-- 10. 图片反馈表
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

-- 11. 翻译缓存表
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

-- ============================================
-- 四、推荐系统相关
-- ============================================

-- 12. 用户行为事件表
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                       -- 'view' | 'generate' | 'like' | 'dislike' | 'download' | 'share' | 'copy_prompt'
  target_type TEXT NOT NULL,                      -- 'generation' | 'tag' | 'template' | 'model'
  target_id TEXT NOT NULL,                        -- 目标ID
  metadata JSONB,                                 -- 额外数据（停留时长、来源等）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. 用户偏好画像表
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL,                  -- 'tag_category' | 'model' | 'style'
  preference_key TEXT NOT NULL,                   -- 具体值：'art_style:cyberpunk' | 'flux-schnell'
  score DECIMAL(10, 4) DEFAULT 0,                 -- 偏好分数（基于行为计算）
  interaction_count INTEGER DEFAULT 0,            -- 交互次数
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, preference_type, preference_key)
);

-- 14. 推荐记录表
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,              -- 'tag' | 'template' | 'prompt' | 'generation'
  recommended_items JSONB NOT NULL,               -- 推荐的内容列表
  algorithm TEXT NOT NULL,                        -- 'popularity' | 'content_based' | 'collaborative' | 'hybrid'
  context JSONB,                                  -- 推荐时的上下文（当前输入、已选标签等）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. 推荐交互表
CREATE TABLE IF NOT EXISTS recommendation_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,                          -- 被交互的推荐项
  action TEXT NOT NULL,                           -- 'click' | 'adopt' | 'ignore' | 'dismiss'
  position INTEGER,                               -- 在推荐列表中的位置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. 实验配置表（A/B测试）
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                             -- '推荐算法对比v1'
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  variants JSONB NOT NULL,                        -- [{"id": "control", "name": "热门推荐", "weight": 50}, ...]
  target_metric TEXT NOT NULL,                    -- 'like_rate' | 'adoption_rate' | 'retention'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. 用户实验分组表
CREATE TABLE IF NOT EXISTS user_experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,                       -- 'control' | 'test'
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, experiment_id)
);

-- 18. 热门内容表
CREATE TABLE IF NOT EXISTS popular_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,                        -- 'generation' | 'tag_combo' | 'prompt' | 'model'
  item_id TEXT NOT NULL,
  item_data JSONB,                                -- 缓存的内容数据
  score DECIMAL(10, 4) DEFAULT 0,                 -- 热度分数
  time_period TEXT NOT NULL,                      -- 'daily' | 'weekly' | 'monthly' | 'all_time'
  rank INTEGER,                                   -- 排名
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_type, item_id, time_period)
);

-- ============================================
-- 索引创建
-- ============================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_reset_date ON users(last_reset_date);

-- 认证账号表索引
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_provider ON auth_accounts(provider);

-- 标签表索引
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tags_is_enabled ON tags(is_enabled);

-- 场景模板表索引
CREATE INDEX IF NOT EXISTS idx_scene_templates_is_enabled ON scene_templates(is_enabled);

-- AI模型表索引
CREATE INDEX IF NOT EXISTS idx_ai_models_is_enabled ON ai_models(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);

-- 生成记录表索引
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_is_public ON generations(is_public);
CREATE INDEX IF NOT EXISTS idx_generations_like_count ON generations(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_generations_is_featured ON generations(is_featured);

-- 标签统计表索引
CREATE INDEX IF NOT EXISTS idx_tag_stats_category ON tag_stats(tag_category);
CREATE INDEX IF NOT EXISTS idx_tag_stats_usage ON tag_stats(usage_count DESC);

-- 图片反馈表索引
CREATE INDEX IF NOT EXISTS idx_image_feedback_generation ON image_feedback(generation_id);
CREATE INDEX IF NOT EXISTS idx_image_feedback_user ON image_feedback(user_id);

-- 翻译缓存表索引
CREATE INDEX IF NOT EXISTS idx_prompt_translations_hash ON prompt_translations(original_prompt_hash);

-- 每日统计表索引
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);

-- 用户事件表索引
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_target ON user_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);

-- 用户偏好表索引
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(preference_type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_score ON user_preferences(score DESC);

-- 推荐记录表索引
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_algorithm ON recommendations(algorithm);

-- 推荐交互表索引
CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_recommendation ON recommendation_interactions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_user ON recommendation_interactions(user_id);

-- 实验表索引
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- 用户实验分组表索引
CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_user ON user_experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_experiment ON user_experiment_assignments(experiment_id);

-- 热门内容表索引
CREATE INDEX IF NOT EXISTS idx_popular_items_type_period ON popular_items(item_type, time_period);
CREATE INDEX IF NOT EXISTS idx_popular_items_score ON popular_items(score DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE popular_items ENABLE ROW LEVEL SECURITY;

-- RLS 策略（允许匿名访问）
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on auth_accounts" ON auth_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tags" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on scene_templates" ON scene_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ai_models" ON ai_models FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on generations" ON generations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on prompt_stats" ON prompt_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daily_stats" ON daily_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tag_stats" ON tag_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on image_feedback" ON image_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on prompt_translations" ON prompt_translations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_events" ON user_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_preferences" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on recommendations" ON recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on recommendation_interactions" ON recommendation_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on experiments" ON experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_experiment_assignments" ON user_experiment_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on popular_items" ON popular_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 触发器
-- ============================================

-- 更新时间戳触发器函数
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

CREATE TRIGGER update_auth_accounts_updated_at BEFORE UPDATE ON auth_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scene_templates_updated_at BEFORE UPDATE ON scene_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tag_stats_updated_at BEFORE UPDATE ON tag_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_translations_updated_at BEFORE UPDATE ON prompt_translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始数据：AI模型配置
-- ============================================

INSERT INTO ai_models (id, name, description, provider, cost_per_generation, runs_number, tags, default_config, capabilities, sort_order) VALUES
(
  'flux-schnell',
  'black-forest-labs',
  '超快速生成，4步出图，适合快速迭代和预览',
  'replicate',
  0.003,
  '392.8M',
  ARRAY['超快', '经济', '推荐'],
  '{"numInferenceSteps": 4, "aspectRatio": "1:1", "outputFormat": "webp", "numOutputs": 4}',
  '{"supportsAspectRatio": true, "maxSteps": 4, "maxOutputs": 4, "supportedFormats": ["webp", "jpg", "png"]}',
  1
),
(
  'imagen-4-ultra',
  'Google',
  '高质量生成，细节丰富，适合最终作品和专业用途',
  'replicate',
  0.004,
  '677.9K',
  ARRAY['高质量', '专业'],
  '{"numInferenceSteps": 28, "aspectRatio": "16:9", "outputFormat": "jpg", "numOutputs": 1}',
  '{"supportsAspectRatio": true, "maxSteps": 50, "maxOutputs": 1, "supportedFormats": ["jpg", "png"]}',
  2
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cost_per_generation = EXCLUDED.cost_per_generation,
  runs_number = EXCLUDED.runs_number,
  tags = EXCLUDED.tags,
  default_config = EXCLUDED.default_config,
  capabilities = EXCLUDED.capabilities,
  updated_at = NOW();

-- ============================================
-- 初始数据：标签定义
-- ============================================

-- 艺术风格组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('art_style', '摄影级逼真', 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed', '摄影级逼真效果', 1),
('art_style', '电影级画质', 'cinematic photography, film photography, dramatic lighting, cinematic composition', '电影级摄影画质', 2),
('art_style', '油画风格', 'oil painting, classical art, brush strokes, Renaissance style', '经典油画风格', 3),
('art_style', '水彩画', 'watercolor painting, soft brushes, artistic, flowing colors', '柔美水彩画风', 4),
('art_style', '动漫风格', 'anime style, manga, japanese animation, cel shading', '日式动漫风格', 5),
('art_style', '像素艺术', 'pixel art, 8-bit, retro gaming style, pixelated', '复古像素艺术', 6),
('art_style', '素描风格', 'pencil sketch, black and white, hand drawn, charcoal drawing', '手绘素描风格', 7),
('art_style', '概念艺术', 'concept art, digital painting, matte painting, professional illustration', '游戏概念艺术', 8),
('art_style', '3D渲染', '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering', '3D渲染技术', 9),
('art_style', '印象派', 'impressionist style, soft focus, painterly, artistic brushwork', '印象派艺术风格', 10);

-- 主题风格组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('theme_style', '赛博朋克', 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets', '赛博朋克未来都市', 1),
('theme_style', '科幻场景', 'sci-fi, futuristic, space technology, holographic displays, advanced technology', '科幻未来场景', 2),
('theme_style', '奇幻风格', 'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere', '奇幻魔法世界', 3),
('theme_style', '蒸汽朋克', 'steampunk, vintage machinery, brass gears, Victorian era, industrial', '蒸汽朋克机械风', 4),
('theme_style', '中国风', 'chinese style, traditional, elegant, ink wash painting, oriental aesthetics', '中国传统古风', 5),
('theme_style', '现代简约', 'modern, minimalist, clean design, sleek, contemporary', '现代简约设计', 6),
('theme_style', '复古未来', 'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave', '复古未来主义', 7),
('theme_style', '自然生态', 'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable', '自然生态风格', 8),
('theme_style', '工业风格', 'industrial design, metallic textures, concrete, raw materials, urban decay', '工业废土风格', 9),
('theme_style', '哥特风格', 'gothic architecture, dark romantic, ornate details, mysterious atmosphere', '哥特神秘风格', 10);

-- 情绪氛围组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('mood', '温暖明亮', 'warm lighting, bright, cheerful, golden hour, soft sunlight', '温暖明亮氛围', 1),
('mood', '神秘暗黑', 'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro', '神秘暗黑氛围', 2),
('mood', '梦幻唯美', 'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like', '梦幻唯美氛围', 3),
('mood', '震撼史诗', 'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring', '震撼史诗氛围', 4),
('mood', '宁静平和', 'peaceful, calm, serene, tranquil, meditation, zen atmosphere', '宁静禅意氛围', 5),
('mood', '活力动感', 'energetic, dynamic, vibrant, lively, high-energy, action-packed', '活力动感氛围', 6),
('mood', '忧郁沉思', 'melancholic, contemplative, nostalgic, bittersweet, introspective', '忧郁沉思氛围', 7),
('mood', '奢华高贵', 'luxurious, elegant, sophisticated, premium, high-end, glamorous', '奢华高贵氛围', 8),
('mood', '原始野性', 'wild, primal, untamed, rugged, natural, raw power', '原始野性氛围', 9),
('mood', '未来科技', 'futuristic, high-tech, digital, cyber, holographic, technological', '未来科技氛围', 10);

-- 技术参数组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('technical', '85mm镜头', '85mm lens, portrait lens, shallow depth of field', '85mm人像镜头', 1),
('technical', '广角镜头', 'wide-angle lens, 24mm, expansive view, environmental context', '24mm广角镜头', 2),
('technical', '微距摄影', 'macro photography, extreme close-up, intricate details, magnified', '微距特写摄影', 3),
('technical', '长焦镜头', 'telephoto lens, 200mm, compressed perspective, background blur', '200mm长焦镜头', 4),
('technical', '鱼眼效果', 'fisheye lens, distorted perspective, 180-degree view, curved edges', '鱼眼广角效果', 5),
('technical', '景深控制', 'shallow depth of field, f/1.4, bokeh effect, selective focus', '浅景深虚化', 6),
('technical', '全景深', 'deep focus, f/11, everything in focus, landscape photography', '全景深清晰', 7),
('technical', '黄金时刻', 'golden hour lighting, warm sunlight, magic hour, soft shadows', '黄金时刻光线', 8),
('technical', '蓝调时刻', 'blue hour, twilight, evening atmosphere, city lights', '蓝调时刻光线', 9),
('technical', '工作室灯光', 'studio lighting, softbox, professional lighting setup, controlled environment', '专业工作室灯光', 10);

-- 构图参数组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('composition', '三分法则', 'rule of thirds, balanced composition, dynamic framing', '三分法则构图', 1),
('composition', '中心构图', 'centered composition, symmetrical, balanced, focal point', '中心对称构图', 2),
('composition', '低角度仰拍', 'low angle shot, worm eye view, heroic perspective, dramatic angle', '低角度仰拍视角', 3),
('composition', '高角度俯拍', 'high angle shot, bird eye view, overhead perspective, aerial view', '高角度俯拍视角', 4),
('composition', '特写镜头', 'close-up shot, intimate framing, detailed focus, emotional connection', '特写镜头构图', 5),
('composition', '全景镜头', 'wide shot, establishing shot, environmental context, full scene', '全景镜头构图', 6),
('composition', '肩部特写', 'medium shot, upper body, conversational framing, portrait style', '肩部特写构图', 7),
('composition', '极近特写', 'extreme close-up, macro detail, textural focus, intimate detail', '极近特写构图', 8),
('composition', '动态构图', 'dynamic composition, diagonal lines, movement, energy', '动态运动构图', 9),
('composition', '极简构图', 'minimalist composition, negative space, clean lines, simple elegance', '极简留白构图', 10);

-- 增强属性组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('enhancement', '超高细节', 'highly detailed, intricate details, ultra-detailed textures, photorealistic details', '超高细节刻画', 1),
('enhancement', '电影感', 'cinematic composition, film photography, movie-like quality, Hollywood style', '电影质感效果', 2),
('enhancement', '专业摄影', 'professional photography, studio quality, commercial grade, award-winning', '专业摄影品质', 3),
('enhancement', '艺术大师', 'masterpiece, award winning, gallery quality, museum piece', '艺术大师作品', 4),
('enhancement', '体积光效', 'volumetric lighting, god rays, atmospheric lighting, light beams', '体积光线效果', 5),
('enhancement', '色彩分级', 'color grading, cinematic colors, film look, professional color correction', '电影级色彩调色', 6),
('enhancement', 'HDR效果', 'HDR photography, high dynamic range, enhanced contrast, vivid colors', 'HDR高动态范围', 7),
('enhancement', '胶片质感', 'film grain, analog photography, vintage film look, organic texture', '胶片质感效果', 8);

-- 主题建议组
INSERT INTO tags (category, label, value, display_value, sort_order) VALUES
('subject_suggestion', '美丽的风景画', '美丽的风景画', '风景主题', 1),
('subject_suggestion', '未来城市天际线', '未来城市天际线', '城市主题', 2),
('subject_suggestion', '可爱的动物', '可爱的动物', '动物主题', 3),
('subject_suggestion', '科幻机器人', '科幻机器人', '科幻主题', 4),
('subject_suggestion', '奇幻生物', '奇幻生物', '奇幻主题', 5),
('subject_suggestion', '抽象艺术', '抽象艺术', '抽象主题', 6),
('subject_suggestion', '人物肖像', '人物肖像', '人像主题', 7),
('subject_suggestion', '静物摄影', '静物摄影', '静物主题', 8);

-- ============================================
-- 初始数据：场景模板
-- ============================================

INSERT INTO scene_templates (label, prompt, technical, lighting, mood, sort_order) VALUES
('人像摄影', '专业人像摄影', '85mm lens, shallow depth of field, f/1.8', 'soft studio lighting, professional portrait setup', 'confident, professional atmosphere', 1),
('风景摄影', '壮丽自然风景', 'wide-angle lens, deep focus, f/11', 'golden hour lighting, dramatic sky', 'majestic, awe-inspiring atmosphere', 2),
('产品摄影', '高端产品展示', 'macro lens, perfect focus, commercial quality', 'studio lighting, gradient shadows, clean background', 'premium, elegant, minimalist', 3),
('街头摄影', '真实街头场景', '35mm lens, documentary style, candid moment', 'natural lighting, urban environment', 'authentic, gritty, urban life', 4);
