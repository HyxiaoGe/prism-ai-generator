-- ============================================
-- 场景模板表字段修复迁移脚本
-- 目的：添加场景包所需的缺失字段，统一场景包和数据库模板
-- ============================================

-- 步骤1：添加缺失的基本字段
-- ============================================

-- 1.1 添加英文名称字段
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN scene_templates.name_en IS '英文名称，用于国际化显示';

-- 1.2 添加图标字段（emoji或图标名称）
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS icon TEXT;

COMMENT ON COLUMN scene_templates.icon IS '图标（emoji或图标名称），如 "👤", "🏔️"';

-- 1.3 添加示例数组（多个示例描述）
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS examples TEXT[] DEFAULT '{}';

COMMENT ON COLUMN scene_templates.examples IS '示例描述数组，展示该模板可以生成什么样的图片';

-- 1.4 添加使用提示
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS tips TEXT;

COMMENT ON COLUMN scene_templates.tips IS '使用提示，告诉用户该模板适合什么场景';

-- 步骤2：添加推荐配置字段
-- ============================================

-- 2.1 推荐AI模型
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS recommended_model TEXT DEFAULT 'flux-schnell';

COMMENT ON COLUMN scene_templates.recommended_model IS '推荐的AI模型，如 "flux-schnell", "flux-dev"';

-- 2.2 推荐宽高比
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS recommended_aspect_ratio TEXT DEFAULT '1:1';

-- 添加约束：只允许特定值
ALTER TABLE scene_templates
ADD CONSTRAINT check_recommended_aspect_ratio
CHECK (recommended_aspect_ratio IN ('1:1', '16:9', '9:16', '4:3', '3:4'));

COMMENT ON COLUMN scene_templates.recommended_aspect_ratio IS '推荐的宽高比，如 "1:1", "16:9"';

-- 2.3 推荐推理步数
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS recommended_steps INTEGER DEFAULT 4;

-- 添加约束：步数在合理范围内
ALTER TABLE scene_templates
ADD CONSTRAINT check_recommended_steps
CHECK (recommended_steps >= 1 AND recommended_steps <= 50);

COMMENT ON COLUMN scene_templates.recommended_steps IS '推荐的推理步数，影响生成质量和速度';

-- 2.4 推荐输出格式
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS recommended_output_format TEXT DEFAULT 'webp';

ALTER TABLE scene_templates
ADD CONSTRAINT check_recommended_output_format
CHECK (recommended_output_format IN ('webp', 'jpg', 'png'));

COMMENT ON COLUMN scene_templates.recommended_output_format IS '推荐的输出格式，如 "webp", "jpg", "png"';

-- 2.5 推荐输出数量
ALTER TABLE scene_templates
ADD COLUMN IF NOT EXISTS recommended_num_outputs INTEGER DEFAULT 4;

ALTER TABLE scene_templates
ADD CONSTRAINT check_recommended_num_outputs
CHECK (recommended_num_outputs >= 1 AND recommended_num_outputs <= 4);

COMMENT ON COLUMN scene_templates.recommended_num_outputs IS '推荐的输出图片数量（1-4）';

-- 步骤3：规范化现有字段
-- ============================================

-- 3.1 确保 category 字段有合理的约束（可选，根据实际需求调整）
-- 注意：如果已有数据不符合这些值，先清理数据再添加约束
DO $$
BEGIN
  -- 检查是否已存在该约束
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_category_values'
  ) THEN
    ALTER TABLE scene_templates
    ADD CONSTRAINT check_category_values
    CHECK (category IN (
      'portrait',      -- 人像
      'landscape',     -- 风景
      'art',           -- 艺术
      'design',        -- 设计
      'product',       -- 产品
      'anime',         -- 动漫
      'other'          -- 其他
    ));
  END IF;
END $$;

COMMENT ON COLUMN scene_templates.category IS '主分类：portrait(人像), landscape(风景), art(艺术), design(设计), product(产品), anime(动漫), other(其他)';

-- 步骤4：创建索引以提升查询性能
-- ============================================

-- 4.1 为新字段创建索引
CREATE INDEX IF NOT EXISTS idx_scene_templates_recommended_model
ON scene_templates(recommended_model);

CREATE INDEX IF NOT EXISTS idx_scene_templates_icon
ON scene_templates(icon)
WHERE icon IS NOT NULL;

-- 4.2 为推荐配置创建复合索引（常用查询组合）
CREATE INDEX IF NOT EXISTS idx_scene_templates_recommended_config
ON scene_templates(recommended_model, recommended_aspect_ratio, difficulty);

-- 步骤5：更新现有数据的默认值（如果表中已有数据）
-- ============================================

-- 5.1 为现有记录设置默认推荐配置（可根据实际情况调整）
UPDATE scene_templates
SET
  recommended_model = COALESCE(recommended_model, 'flux-schnell'),
  recommended_aspect_ratio = COALESCE(recommended_aspect_ratio, '1:1'),
  recommended_steps = COALESCE(recommended_steps, 4),
  recommended_output_format = COALESCE(recommended_output_format, 'webp'),
  recommended_num_outputs = COALESCE(recommended_num_outputs, 4)
WHERE
  recommended_model IS NULL
  OR recommended_aspect_ratio IS NULL
  OR recommended_steps IS NULL
  OR recommended_output_format IS NULL
  OR recommended_num_outputs IS NULL;

-- 5.2 为现有记录生成默认图标（基于分类）
UPDATE scene_templates
SET icon = CASE
  WHEN category = 'portrait' THEN '👤'
  WHEN category = 'landscape' THEN '🏔️'
  WHEN category = 'art' THEN '🎨'
  WHEN category = 'design' THEN '⚪'
  WHEN category = 'product' THEN '📦'
  WHEN category = 'anime' THEN '🎭'
  ELSE '✨'
END
WHERE icon IS NULL;

-- 步骤6：创建视图以方便查询完整场景包信息
-- ============================================

CREATE OR REPLACE VIEW v_scene_packs AS
SELECT
  t.id,
  t.name,
  t.name_en,
  t.icon,
  t.category,
  t.subcategory,
  t.tags,
  t.difficulty,
  t.description,
  t.base_prompt,
  t.suggested_tags,
  t.thumbnail_url,
  t.example_images,
  t.examples,
  t.tips,
  t.recommended_model,
  t.recommended_aspect_ratio,
  t.recommended_steps,
  t.recommended_output_format,
  t.recommended_num_outputs,
  t.usage_count,
  t.rating,
  t.likes_count,
  t.is_official,
  t.is_public,
  t.status,
  t.created_at,
  t.updated_at,
  -- 统计信息
  COUNT(DISTINCT f.user_id) as favorites_count,
  COUNT(DISTINCT r.id) as ratings_count,
  AVG(r.rating) as avg_rating_detailed
FROM scene_templates t
LEFT JOIN user_template_favorites f ON f.template_id = t.id
LEFT JOIN template_ratings r ON r.template_id = t.id
WHERE t.status = 'active'
GROUP BY t.id;

COMMENT ON VIEW v_scene_packs IS '场景包完整视图，包含统计信息';

-- 步骤7：创建辅助函数
-- ============================================

-- 7.1 函数：获取场景包的完整配置
CREATE OR REPLACE FUNCTION get_scene_pack_config(pack_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', id,
    'name', name,
    'recommended_config', json_build_object(
      'model', recommended_model,
      'aspectRatio', recommended_aspect_ratio,
      'numInferenceSteps', recommended_steps,
      'outputFormat', recommended_output_format,
      'numOutputs', recommended_num_outputs
    ),
    'tags', suggested_tags,
    'basePrompt', base_prompt
  )
  INTO result
  FROM scene_templates
  WHERE id = pack_id AND status = 'active';

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_scene_pack_config IS '获取场景包的完整配置（包括推荐参数和标签）';

-- 步骤8：数据验证
-- ============================================

-- 8.1 检查是否有 NULL 值在不应该为 NULL 的字段中
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM scene_templates
  WHERE status = 'active' AND (
    name IS NULL OR
    category IS NULL OR
    base_prompt IS NULL OR
    recommended_model IS NULL OR
    recommended_aspect_ratio IS NULL OR
    recommended_steps IS NULL
  );

  IF null_count > 0 THEN
    RAISE NOTICE '⚠️  警告：发现 % 条活跃记录存在必填字段为 NULL', null_count;
  ELSE
    RAISE NOTICE '✅ 数据验证通过：所有活跃记录的必填字段都已正确填充';
  END IF;
END $$;

-- 步骤9：输出迁移总结
-- ============================================

DO $$
DECLARE
  total_count INTEGER;
  active_count INTEGER;
  official_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM scene_templates;
  SELECT COUNT(*) INTO active_count FROM scene_templates WHERE status = 'active';
  SELECT COUNT(*) INTO official_count FROM scene_templates WHERE is_official = true AND status = 'active';

  RAISE NOTICE '====================================';
  RAISE NOTICE '场景模板表字段修复完成！';
  RAISE NOTICE '====================================';
  RAISE NOTICE '总记录数: %', total_count;
  RAISE NOTICE '活跃记录数: %', active_count;
  RAISE NOTICE '官方场景包数: %', official_count;
  RAISE NOTICE '====================================';
  RAISE NOTICE '新增字段：';
  RAISE NOTICE '  - name_en (英文名称)';
  RAISE NOTICE '  - icon (图标)';
  RAISE NOTICE '  - examples (示例数组)';
  RAISE NOTICE '  - tips (使用提示)';
  RAISE NOTICE '  - recommended_model (推荐模型)';
  RAISE NOTICE '  - recommended_aspect_ratio (推荐宽高比)';
  RAISE NOTICE '  - recommended_steps (推荐步数)';
  RAISE NOTICE '  - recommended_output_format (推荐格式)';
  RAISE NOTICE '  - recommended_num_outputs (推荐数量)';
  RAISE NOTICE '====================================';
  RAISE NOTICE '新增对象：';
  RAISE NOTICE '  - v_scene_packs (视图)';
  RAISE NOTICE '  - get_scene_pack_config() (函数)';
  RAISE NOTICE '====================================';
END $$;

-- ============================================
-- 迁移完成！
-- 现在场景包和数据库模板的字段已经统一
-- ============================================
