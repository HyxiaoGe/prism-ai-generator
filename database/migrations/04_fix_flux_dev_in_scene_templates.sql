-- ============================================
-- 修复数据库中的 flux-dev 模型引用
-- 将所有 flux-dev 替换为 flux-schnell，步数从28改为4
-- ============================================

-- 更新scene_templates表中使用flux-dev的场景包
UPDATE scene_templates
SET
  recommended_model = 'flux-schnell',
  recommended_steps = 4,
  updated_at = NOW()
WHERE
  recommended_model = 'flux-dev'
  AND is_official = true
  AND status = 'active';

-- 输出更新结果
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 统计更新的记录数
  SELECT COUNT(*) INTO updated_count
  FROM scene_templates
  WHERE recommended_model = 'flux-schnell' AND is_official = true;

  RAISE NOTICE '====================================';
  RAISE NOTICE 'Flux-dev 模型引用修复完成！';
  RAISE NOTICE '====================================';
  RAISE NOTICE '已更新场景包数量: %', updated_count;
  RAISE NOTICE '新配置: flux-schnell, 步数=4';
  RAISE NOTICE '====================================';
  RAISE NOTICE '验证查询：';
  RAISE NOTICE '  SELECT name, recommended_model, recommended_steps';
  RAISE NOTICE '  FROM scene_templates WHERE is_official = true;';
  RAISE NOTICE '====================================';
END $$;

-- 验证：显示所有官方场景包的模型配置
SELECT
  name,
  name_en,
  recommended_model,
  recommended_steps,
  recommended_aspect_ratio,
  category,
  difficulty
FROM scene_templates
WHERE is_official = true AND status = 'active'
ORDER BY name;
