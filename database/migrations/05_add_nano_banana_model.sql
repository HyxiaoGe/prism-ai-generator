-- ==============================================
-- 添加 Google Nano Banana (Gemini 2.5 Flash Image) 模型
-- ==============================================

-- 插入 nano-banana 模型配置
INSERT INTO ai_models (
  id,
  name,
  description,
  provider,
  cost_per_generation,
  runs_number,
  tags,
  default_config,
  capabilities,
  is_enabled,
  sort_order,
  created_at,
  updated_at
) VALUES (
  'nano-banana',
  'Google',
  'Google Gemini 2.5 Flash Image 模型，速度快2-3倍，擅长快速迭代和创意工作流，支持多种分辨率和宽高比',
  'replicate',
  0.039,
  '1.2M',
  '["快速", "多分辨率", "推荐"]',
  '{
    "numInferenceSteps": 28,
    "aspectRatio": "1:1",
    "outputFormat": "jpg",
    "numOutputs": 1
  }',
  '{
    "supportsAspectRatio": true,
    "maxSteps": 50,
    "maxOutputs": 1,
    "supportedFormats": ["jpg", "png"],
    "supportedAspectRatios": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    "supportedResolutions": ["1K", "2K", "4K"]
  }',
  true,
  3,
  NOW(),
  NOW()
);

-- 验证插入结果
SELECT id, name, is_enabled, sort_order FROM ai_models WHERE is_enabled = true ORDER BY sort_order;

-- ==============================================
-- 迁移完成！
-- 现在系统中有3个启用的模型：
-- 1. flux-schnell (超快速，4步出图)
-- 2. imagen-4-ultra (高质量，28步精品)
-- 3. nano-banana (快速迭代，多分辨率支持)
-- ==============================================
