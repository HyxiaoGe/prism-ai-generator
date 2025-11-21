-- ============================================
-- 场景包使用统计和数据同步迁移脚本
-- 目的：
-- 1. 将硬编码的8个场景包同步到数据库
-- 2. 创建使用统计表
-- 3. 实现统计功能
-- ============================================

-- ============================================
-- 第一部分：同步硬编码场景包到数据库
-- ============================================

-- 1. 插入或更新8个官方场景包
-- 使用 ON CONFLICT 确保幂等性（可以重复执行）

INSERT INTO scene_templates (
  name,
  name_en,
  icon,
  category,
  subcategory,
  description,
  difficulty,
  base_prompt,
  suggested_tags,
  thumbnail_url,
  examples,
  tips,
  recommended_model,
  recommended_aspect_ratio,
  recommended_steps,
  recommended_output_format,
  recommended_num_outputs,
  tags,
  is_official,
  is_public,
  status
) VALUES
-- 1. 人像摄影
(
  '人像摄影',
  'Portrait Photography',
  '👤',
  'portrait',
  NULL,
  '专业人像照片，85mm镜头，浅景深，工作室灯光',
  'beginner',
  '商务人士的职业照片',
  '{
    "art_style": ["photorealistic"],
    "mood": ["warm-bright"],
    "technical": ["85mm-lens", "shallow-dof", "studio-lighting"],
    "enhancement": ["highly-detailed", "professional"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop',
  ARRAY['商务人士的职业照片', '优雅女性肖像', '阳光男性形象照'],
  '适合创作头像、简历照、社交媒体形象照',
  'flux-dev',
  '3:4',
  28,
  'webp',
  4,
  ARRAY['人像', '摄影', '专业'],
  true,
  true,
  'active'
),

-- 2. 风景大片
(
  '风景大片',
  'Epic Landscape',
  '🏔️',
  'landscape',
  NULL,
  '壮丽自然风光，广角镜头，黄金时刻，电影级质感',
  'beginner',
  '雪山日落壮景',
  '{
    "art_style": ["cinematic"],
    "theme_style": ["nature"],
    "mood": ["epic"],
    "technical": ["wide-angle", "golden-hour"],
    "composition": ["rule-of-thirds", "dynamic"],
    "enhancement": ["highly-detailed", "hdr", "cinematic-quality"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop',
  ARRAY['雪山日落壮景', '森林晨雾仙境', '海边惊涛骇浪'],
  '适合创作桌面壁纸、旅游风光、自然摄影',
  'flux-schnell',
  '16:9',
  4,
  'webp',
  4,
  ARRAY['风景', '自然', '壮观'],
  true,
  true,
  'active'
),

-- 3. 国风插画
(
  '国风插画',
  'Chinese Art',
  '🎨',
  'art',
  'chinese-style',
  '中国传统艺术风格，水墨质感，诗意氛围',
  'intermediate',
  '古装美人画像',
  '{
    "art_style": ["watercolor"],
    "theme_style": ["chinese-style"],
    "mood": ["dreamy"],
    "composition": ["centered"],
    "enhancement": ["masterpiece", "highly-detailed"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=450&fit=crop',
  ARRAY['古装美人画像', '山水意境画', '水墨花鸟图'],
  '适合创作国风插画、传统艺术作品',
  'flux-dev',
  '3:4',
  28,
  'webp',
  4,
  ARRAY['国风', '中国风', '水墨'],
  true,
  true,
  'active'
),

-- 4. 赛博朋克
(
  '赛博朋克',
  'Cyberpunk',
  '🤖',
  'art',
  'cyberpunk',
  '未来科技感，霓虹灯效果，戏剧性灯光',
  'intermediate',
  '未来都市夜景',
  '{
    "art_style": ["cinematic"],
    "theme_style": ["cyberpunk"],
    "mood": ["futuristic-tech"],
    "technical": ["blue-hour"],
    "composition": ["dynamic"],
    "enhancement": ["highly-detailed", "color-grading", "bloom"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1509043759401-136742328bb3?w=800&h=450&fit=crop',
  ARRAY['未来都市夜景', '赛博女战士', '霓虹街道场景'],
  '适合创作科幻场景、游戏概念图',
  'flux-schnell',
  '16:9',
  4,
  'webp',
  4,
  ARRAY['赛博朋克', '科幻', '未来'],
  true,
  true,
  'active'
),

-- 5. 产品摄影
(
  '产品摄影',
  'Product Photography',
  '📦',
  'product',
  NULL,
  '商业产品摄影，白色背景，专业灯光',
  'beginner',
  '电子产品特写',
  '{
    "art_style": ["photorealistic"],
    "technical": ["macro", "studio-lighting"],
    "composition": ["centered", "minimalist"],
    "enhancement": ["highly-detailed", "professional"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=450&fit=crop',
  ARRAY['电子产品特写', '美妆产品展示', '食品摄影'],
  '适合电商产品图、广告素材',
  'flux-dev',
  '1:1',
  28,
  'webp',
  4,
  ARRAY['产品', '商业', '摄影'],
  true,
  true,
  'active'
),

-- 6. 动漫角色
(
  '动漫角色',
  'Anime Character',
  '🎭',
  'art',
  'anime',
  '日系动漫风格，明亮色彩，动态构图',
  'intermediate',
  '少女角色立绘',
  '{
    "art_style": ["anime"],
    "mood": ["energetic"],
    "composition": ["dynamic", "close-up"],
    "enhancement": ["highly-detailed", "color-grading"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=450&fit=crop',
  ARRAY['少女角色立绘', '战斗场景', '日常生活场景'],
  '适合动漫角色设计、游戏立绘',
  'flux-schnell',
  '3:4',
  4,
  'webp',
  4,
  ARRAY['动漫', '角色', '日系'],
  true,
  true,
  'active'
),

-- 7. 古典油画
(
  '古典油画',
  'Classical Oil Painting',
  '🖼️',
  'art',
  'oil-painting',
  '欧洲古典油画风格，厚重质感，温暖色调',
  'advanced',
  '贵族肖像',
  '{
    "art_style": ["oil-painting"],
    "mood": ["luxurious"],
    "composition": ["centered"],
    "enhancement": ["masterpiece", "highly-detailed"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=450&fit=crop',
  ARRAY['贵族肖像', '静物写生', '宗教题材'],
  '适合艺术创作、古典风格作品',
  'flux-dev',
  '4:3',
  28,
  'webp',
  4,
  ARRAY['油画', '古典', '艺术'],
  true,
  true,
  'active'
),

-- 8. 现代简约
(
  '现代简约',
  'Modern Minimalist',
  '⚪',
  'design',
  NULL,
  '现代简约风格，干净利落，留白设计',
  'beginner',
  '建筑空间',
  '{
    "art_style": ["concept-art"],
    "theme_style": ["modern"],
    "mood": ["peaceful"],
    "composition": ["minimalist", "centered"],
    "enhancement": ["professional"]
  }'::jsonb,
  'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=800&h=450&fit=crop',
  ARRAY['建筑空间', '产品设计', '抽象艺术'],
  '适合现代设计、品牌视觉',
  'flux-schnell',
  '16:9',
  4,
  'webp',
  4,
  ARRAY['现代', '简约', '设计'],
  true,
  true,
  'active'
)

ON CONFLICT (name, is_official)
DO UPDATE SET
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  description = EXCLUDED.description,
  difficulty = EXCLUDED.difficulty,
  base_prompt = EXCLUDED.base_prompt,
  suggested_tags = EXCLUDED.suggested_tags,
  thumbnail_url = EXCLUDED.thumbnail_url,
  examples = EXCLUDED.examples,
  tips = EXCLUDED.tips,
  recommended_model = EXCLUDED.recommended_model,
  recommended_aspect_ratio = EXCLUDED.recommended_aspect_ratio,
  recommended_steps = EXCLUDED.recommended_steps,
  recommended_output_format = EXCLUDED.recommended_output_format,
  recommended_num_outputs = EXCLUDED.recommended_num_outputs,
  tags = EXCLUDED.tags,
  updated_at = NOW()
WHERE scene_templates.is_official = true;

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scene_templates_name_is_official_key'
  ) THEN
    ALTER TABLE scene_templates
    ADD CONSTRAINT scene_templates_name_is_official_key
    UNIQUE (name, is_official);
  END IF;
END $$;

-- ============================================
-- 第二部分：创建场景包使用统计表
-- ============================================

-- 2. 创建场景包使用记录表
CREATE TABLE IF NOT EXISTS scene_pack_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 场景包信息（支持硬编码场景包和数据库模板）
  scene_pack_id TEXT,                             -- 硬编码场景包ID（如 'portrait-photography'）
  template_id UUID REFERENCES scene_templates(id) ON DELETE CASCADE, -- 数据库模板ID

  -- 用户信息
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- 使用信息
  generation_id UUID REFERENCES generations(id) ON DELETE SET NULL, -- 关联的生成记录

  -- 使用结果
  was_successful BOOLEAN DEFAULT true,           -- 生成是否成功
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5), -- 用户评分（1-5）

  -- 应用的配置（用于分析）
  applied_config JSONB,                          -- 应用的完整配置

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 约束：至少要有一个ID
  CONSTRAINT check_has_pack_or_template CHECK (
    scene_pack_id IS NOT NULL OR template_id IS NOT NULL
  )
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_scene_pack_id
ON scene_pack_usage(scene_pack_id);

CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_template_id
ON scene_pack_usage(template_id);

CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_user_id
ON scene_pack_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_created_at
ON scene_pack_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_was_successful
ON scene_pack_usage(was_successful);

-- 复合索引：用于统计热门场景包
CREATE INDEX IF NOT EXISTS idx_scene_pack_usage_pack_success
ON scene_pack_usage(scene_pack_id, was_successful, created_at DESC);

-- ============================================
-- 第三部分：创建统计视图和函数
-- ============================================

-- 3. 创建场景包统计视图
CREATE OR REPLACE VIEW v_scene_pack_stats AS
SELECT
  -- 场景包标识
  COALESCE(spu.scene_pack_id, 'db_' || spu.template_id::text) as pack_identifier,
  spu.scene_pack_id,
  spu.template_id,

  -- 关联的模板信息
  st.name as template_name,
  st.category,
  st.difficulty,
  st.is_official,

  -- 统计信息
  COUNT(*) as total_usage_count,
  COUNT(*) FILTER (WHERE spu.was_successful = true) as successful_usage_count,
  COUNT(*) FILTER (WHERE spu.was_successful = false) as failed_usage_count,
  ROUND(
    COUNT(*) FILTER (WHERE spu.was_successful = true)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate_percentage,

  -- 评分统计
  COUNT(spu.user_rating) as rating_count,
  ROUND(AVG(spu.user_rating), 2) as avg_rating,

  -- 用户统计
  COUNT(DISTINCT spu.user_id) as unique_users,

  -- 时间统计
  MAX(spu.created_at) as last_used_at,
  MIN(spu.created_at) as first_used_at,

  -- 热度分数（综合指标）
  -- 公式：使用次数 * 0.5 + 成功率 * 0.3 + 评分 * 20 * 0.2
  (
    COUNT(*)::numeric * 0.5 +
    (COUNT(*) FILTER (WHERE spu.was_successful = true)::numeric / NULLIF(COUNT(*), 0)) * 100 * 0.3 +
    COALESCE(AVG(spu.user_rating), 0) * 20 * 0.2
  ) as popularity_score

FROM scene_pack_usage spu
LEFT JOIN scene_templates st ON st.id = spu.template_id
GROUP BY spu.scene_pack_id, spu.template_id, st.name, st.category, st.difficulty, st.is_official;

COMMENT ON VIEW v_scene_pack_stats IS '场景包使用统计视图，包含使用次数、成功率、评分等指标';

-- 4. 创建获取热门场景包的函数
CREATE OR REPLACE FUNCTION get_popular_scene_packs(
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  pack_identifier TEXT,
  scene_pack_id TEXT,
  template_id UUID,
  template_name TEXT,
  usage_count BIGINT,
  success_rate NUMERIC,
  avg_rating NUMERIC,
  popularity_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vps.pack_identifier,
    vps.scene_pack_id,
    vps.template_id,
    vps.template_name,
    vps.total_usage_count as usage_count,
    vps.success_rate_percentage as success_rate,
    vps.avg_rating,
    vps.popularity_score
  FROM v_scene_pack_stats vps
  WHERE vps.last_used_at >= NOW() - INTERVAL '1 day' * p_days
  ORDER BY vps.popularity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_popular_scene_packs IS '获取热门场景包列表，按热度分数排序';

-- 5. 创建记录场景包使用的函数
CREATE OR REPLACE FUNCTION record_scene_pack_usage(
  p_scene_pack_id TEXT DEFAULT NULL,
  p_template_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_was_successful BOOLEAN DEFAULT true,
  p_user_rating INTEGER DEFAULT NULL,
  p_applied_config JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  -- 插入使用记录
  INSERT INTO scene_pack_usage (
    scene_pack_id,
    template_id,
    user_id,
    generation_id,
    was_successful,
    user_rating,
    applied_config
  ) VALUES (
    p_scene_pack_id,
    p_template_id,
    p_user_id,
    p_generation_id,
    p_was_successful,
    p_user_rating,
    p_applied_config
  )
  RETURNING id INTO v_usage_id;

  -- 更新模板的使用次数（如果是数据库模板）
  IF p_template_id IS NOT NULL THEN
    UPDATE scene_templates
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = p_template_id;
  END IF;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_scene_pack_usage IS '记录场景包使用，同时更新相关统计';

-- 6. 创建获取用户使用历史的函数
CREATE OR REPLACE FUNCTION get_user_scene_pack_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  usage_id UUID,
  scene_pack_id TEXT,
  template_id UUID,
  template_name TEXT,
  was_successful BOOLEAN,
  user_rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    spu.id as usage_id,
    spu.scene_pack_id,
    spu.template_id,
    st.name as template_name,
    spu.was_successful,
    spu.user_rating,
    spu.created_at
  FROM scene_pack_usage spu
  LEFT JOIN scene_templates st ON st.id = spu.template_id
  WHERE spu.user_id = p_user_id
  ORDER BY spu.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_scene_pack_history IS '获取用户的场景包使用历史';

-- ============================================
-- 第四部分：权限和安全
-- ============================================

-- 启用行级安全
ALTER TABLE scene_pack_usage ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "允许所有用户查看场景包使用统计"
  ON scene_pack_usage FOR SELECT
  USING (true);

CREATE POLICY "允许用户插入自己的使用记录"
  ON scene_pack_usage FOR INSERT
  WITH CHECK (true);

CREATE POLICY "允许用户更新自己的使用记录"
  ON scene_pack_usage FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- 第五部分：数据验证和输出
-- ============================================

DO $$
DECLARE
  official_count INTEGER;
  total_packs INTEGER;
BEGIN
  -- 统计官方场景包数量
  SELECT COUNT(*) INTO official_count
  FROM scene_templates
  WHERE is_official = true AND status = 'active';

  SELECT COUNT(*) INTO total_packs
  FROM scene_templates
  WHERE status = 'active';

  RAISE NOTICE '====================================';
  RAISE NOTICE '场景包使用统计系统部署完成！';
  RAISE NOTICE '====================================';
  RAISE NOTICE '官方场景包数量: %', official_count;
  RAISE NOTICE '总场景包数量: %', total_packs;
  RAISE NOTICE '====================================';
  RAISE NOTICE '新增对象：';
  RAISE NOTICE '  ✅ scene_pack_usage 表';
  RAISE NOTICE '  ✅ v_scene_pack_stats 视图';
  RAISE NOTICE '  ✅ get_popular_scene_packs() 函数';
  RAISE NOTICE '  ✅ record_scene_pack_usage() 函数';
  RAISE NOTICE '  ✅ get_user_scene_pack_history() 函数';
  RAISE NOTICE '====================================';
  RAISE NOTICE '测试查询：';
  RAISE NOTICE '  -- 查看所有官方场景包';
  RAISE NOTICE '  SELECT name, name_en, category, recommended_model';
  RAISE NOTICE '  FROM scene_templates WHERE is_official = true;';
  RAISE NOTICE '';
  RAISE NOTICE '  -- 查看热门场景包';
  RAISE NOTICE '  SELECT * FROM get_popular_scene_packs(10, 30);';
  RAISE NOTICE '====================================';
END $$;

-- ============================================
-- 迁移完成！
-- ============================================
