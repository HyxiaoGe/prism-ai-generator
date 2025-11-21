# P1 优先级修复总结

## 修复概述

本次 P1 修复主要解决场景包使用统计持久化和数据同步问题，确保场景包的使用数据能够被正确记录、查询和分析。

**修复时间**: 2025-11-21
**修复优先级**: P1（高优先级）
**涉及问题**: #7, #8（来自场景包问题分析）

---

## 修复的问题

### P1-1: 场景包使用统计未持久化 (问题 #7)

**问题描述**:
- `trackScenePackUsage()` 方法只输出到控制台日志
- 无法查询历史使用数据
- 无法生成统计报表
- 无法分析用户使用偏好

**修复方案**:
1. 创建 `scene_pack_usage` 数据库表
2. 实现数据库函数 `record_scene_pack_usage()`
3. 更新 `ScenePackIntegrationService` 使用真实数据库操作
4. 在 `App.tsx` 中集成使用追踪

**影响范围**:
- ✅ 后端：数据库表结构
- ✅ 后端：存储过程和函数
- ✅ 前端：`scenePackIntegrationService.ts`
- ✅ 前端：`App.tsx`

---

### P1-2: 硬编码场景包未同步到数据库 (问题 #8)

**问题描述**:
- 8 个硬编码场景包只存在于前端代码
- 无法通过数据库查询场景包配置
- 无法与数据库模板统一管理
- 无法进行跨场景包的统计分析

**修复方案**:
1. 编写迁移脚本将所有硬编码场景包 INSERT 到数据库
2. 使用 `ON CONFLICT` 处理重复情况（幂等性）
3. 确保数据库中的场景包与代码定义保持一致
4. 创建视图和函数方便查询

**影响范围**:
- ✅ 数据库：`scene_templates` 表新增 8 条记录
- ✅ 数据迁移：`03_scene_pack_usage_and_sync.sql`

---

## 技术实现详情

### 1. 数据库表设计

#### `scene_pack_usage` 表

```sql
CREATE TABLE scene_pack_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_pack_id UUID NOT NULL REFERENCES scene_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
  applied_config JSONB,
  was_successful BOOLEAN DEFAULT NULL,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 索引
  CONSTRAINT scene_pack_usage_rating_check CHECK (user_rating >= 1 AND user_rating <= 5)
);

CREATE INDEX idx_scene_pack_usage_scene_pack_id ON scene_pack_usage(scene_pack_id);
CREATE INDEX idx_scene_pack_usage_user_id ON scene_pack_usage(user_id);
CREATE INDEX idx_scene_pack_usage_used_at ON scene_pack_usage(used_at DESC);
```

**字段说明**:
- `scene_pack_id`: 场景包 ID（外键关联 scene_templates）
- `user_id`: 用户 ID（可选，支持匿名使用）
- `generation_id`: 关联的生成记录 ID
- `applied_config`: 应用的配置（JSON 格式）
- `was_successful`: 生成是否成功（可选）
- `user_rating`: 用户评分（1-5 分）
- `used_at`: 使用时间

---

### 2. 数据库视图和函数

#### `v_scene_pack_stats` 统计视图

```sql
CREATE OR REPLACE VIEW v_scene_pack_stats AS
SELECT
  sp.id as scene_pack_id,
  sp.name as scene_pack_name,
  sp.category,
  COUNT(u.id) as total_usage_count,
  COUNT(DISTINCT u.user_id) as unique_user_count,
  COUNT(CASE WHEN u.was_successful = true THEN 1 END) as successful_count,
  COUNT(CASE WHEN u.was_successful = false THEN 1 END) as failed_count,
  ROUND(
    COALESCE(
      COUNT(CASE WHEN u.was_successful = true THEN 1 END)::NUMERIC /
      NULLIF(COUNT(CASE WHEN u.was_successful IS NOT NULL THEN 1 END), 0) * 100,
      0
    ), 2
  ) as success_rate,
  ROUND(AVG(u.user_rating), 2) as avg_rating,
  COUNT(CASE WHEN u.user_rating IS NOT NULL THEN 1 END) as rating_count,
  MAX(u.used_at) as last_used_at,
  -- 热度评分公式：使用次数 * 0.5 + 成功率 * 100 * 0.3 + 平均评分 * 20 * 0.2
  ROUND(
    COUNT(u.id) * 0.5 +
    COALESCE(
      COUNT(CASE WHEN u.was_successful = true THEN 1 END)::NUMERIC /
      NULLIF(COUNT(CASE WHEN u.was_successful IS NOT NULL THEN 1 END), 0) * 100 * 0.3,
      0
    ) +
    COALESCE(AVG(u.user_rating) * 20 * 0.2, 0),
    2
  ) as popularity_score
FROM scene_templates sp
LEFT JOIN scene_pack_usage u ON u.scene_pack_id = sp.id
WHERE sp.is_official = true AND sp.status = 'active'
GROUP BY sp.id, sp.name, sp.category;
```

**热度评分算法**:
- 使用次数权重: 0.5（基础流量）
- 成功率权重: 0.3（质量指标）
- 平均评分权重: 0.2（用户满意度）
- 公式: `popularity_score = usage_count * 0.5 + success_rate * 100 * 0.3 + avg_rating * 20 * 0.2`

---

#### `record_scene_pack_usage()` 记录使用函数

```sql
CREATE OR REPLACE FUNCTION record_scene_pack_usage(
  p_scene_pack_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_applied_config JSONB DEFAULT NULL,
  p_was_successful BOOLEAN DEFAULT NULL,
  p_user_rating INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  -- 验证评分范围
  IF p_user_rating IS NOT NULL AND (p_user_rating < 1 OR p_user_rating > 5) THEN
    RAISE EXCEPTION '用户评分必须在 1-5 之间';
  END IF;

  -- 插入使用记录
  INSERT INTO scene_pack_usage (
    scene_pack_id,
    user_id,
    generation_id,
    applied_config,
    was_successful,
    user_rating
  ) VALUES (
    p_scene_pack_id,
    p_user_id,
    p_generation_id,
    p_applied_config,
    p_was_successful,
    p_user_rating
  )
  RETURNING id INTO v_usage_id;

  -- 更新场景包的 usage_count
  UPDATE scene_templates
  SET usage_count = usage_count + 1
  WHERE id = p_scene_pack_id;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;
```

---

#### `get_popular_scene_packs()` 获取热门场景包

```sql
CREATE OR REPLACE FUNCTION get_popular_scene_packs(
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  scene_pack_id UUID,
  scene_pack_name TEXT,
  category TEXT,
  usage_count BIGINT,
  success_rate NUMERIC,
  avg_rating NUMERIC,
  popularity_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.category,
    COUNT(u.id)::BIGINT as usage_count,
    ROUND(
      COALESCE(
        COUNT(CASE WHEN u.was_successful = true THEN 1 END)::NUMERIC /
        NULLIF(COUNT(CASE WHEN u.was_successful IS NOT NULL THEN 1 END), 0) * 100,
        0
      ), 2
    ) as success_rate,
    ROUND(AVG(u.user_rating), 2) as avg_rating,
    ROUND(
      COUNT(u.id) * 0.5 +
      COALESCE(
        COUNT(CASE WHEN u.was_successful = true THEN 1 END)::NUMERIC /
        NULLIF(COUNT(CASE WHEN u.was_successful IS NOT NULL THEN 1 END), 0) * 100 * 0.3,
        0
      ) +
      COALESCE(AVG(u.user_rating) * 20 * 0.2, 0),
      2
    ) as popularity_score
  FROM scene_templates sp
  LEFT JOIN scene_pack_usage u ON u.scene_pack_id = sp.id
    AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
  WHERE sp.is_official = true AND sp.status = 'active'
  GROUP BY sp.id, sp.name, sp.category
  ORDER BY popularity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

#### `get_user_scene_pack_history()` 获取用户历史

```sql
CREATE OR REPLACE FUNCTION get_user_scene_pack_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  usage_id UUID,
  scene_pack_id UUID,
  scene_pack_name TEXT,
  used_at TIMESTAMPTZ,
  was_successful BOOLEAN,
  user_rating INTEGER,
  applied_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    sp.id,
    sp.name,
    u.used_at,
    u.was_successful,
    u.user_rating,
    u.applied_config
  FROM scene_pack_usage u
  INNER JOIN scene_templates sp ON sp.id = u.scene_pack_id
  WHERE u.user_id = p_user_id
  ORDER BY u.used_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

### 3. 前端服务实现

#### ScenePackIntegrationService 更新

**新增方法 1: `trackScenePackUsage()`**

```typescript
/**
 * 记录场景包使用统计（真实数据库持久化）
 */
async trackScenePackUsage(
  scenePackId: string,
  userId: string,
  options?: {
    generationId?: string;
    wasSuccessful?: boolean;
    userRating?: number;
    appliedConfig?: Partial<GenerationConfig>;
  }
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('record_scene_pack_usage', {
      p_scene_pack_id: scenePackId,
      p_user_id: userId,
      p_generation_id: options?.generationId || null,
      p_applied_config: options?.appliedConfig ? JSON.stringify(options.appliedConfig) : null,
      p_was_successful: options?.wasSuccessful ?? null,
      p_user_rating: options?.userRating ?? null,
    });

    if (error) {
      console.error('记录场景包使用失败:', error);
      throw error;
    }

    console.log('✅ 场景包使用已记录:', {
      scenePackId,
      userId,
      usageId: data,
    });
  } catch (error) {
    console.error('记录场景包使用异常:', error);
    throw error;
  }
}
```

**新增方法 2: `getScenePackStats()`**

```typescript
/**
 * 获取场景包统计数据
 */
async getScenePackStats(scenePackId: string): Promise<ScenePackStats> {
  try {
    const { data, error } = await supabase
      .from('v_scene_pack_stats')
      .select('*')
      .eq('scene_pack_id', scenePackId)
      .single();

    if (error) {
      console.error('获取场景包统计失败:', error);
      throw error;
    }

    return {
      usageCount: data.total_usage_count || 0,
      successRate: data.success_rate || 0,
      avgRating: data.avg_rating || 0,
      ratingCount: data.rating_count || 0,
      lastUsed: data.last_used_at ? new Date(data.last_used_at) : undefined,
      popularityScore: data.popularity_score || 0,
    };
  } catch (error) {
    console.error('获取场景包统计异常:', error);
    throw error;
  }
}
```

**新增方法 3: `getPopularScenePacks()`**

```typescript
/**
 * 获取热门场景包（基于使用统计）
 */
async getPopularScenePacks(
  limit: number = 10,
  days: number = 30
): Promise<ScenePack[]> {
  try {
    const { data, error } = await supabase.rpc('get_popular_scene_packs', {
      p_limit: limit,
      p_days: days,
    });

    if (error) {
      console.error('获取热门场景包失败:', error);
      throw error;
    }

    // 将数据库记录转换为 ScenePack 格式
    return data.map((item: any) => {
      const pack = this.scenePacks.find(sp => sp.id === item.scene_pack_id);
      if (pack) {
        return {
          ...pack,
          stats: {
            usageCount: item.usage_count,
            successRate: item.success_rate,
            avgRating: item.avg_rating,
            popularityScore: item.popularity_score,
          },
        };
      }
      return null;
    }).filter(Boolean);
  } catch (error) {
    console.error('获取热门场景包异常:', error);
    throw error;
  }
}
```

---

#### App.tsx 集成使用追踪

**修改位置**: `frontend/src/App.tsx` 第 172-180 行

```typescript
const handleTemplateClick = async (template: any | SceneTemplate) => {
  // ... 现有逻辑 ...

  // 应用场景包配置
  const result = await scenePackIntegration.applyItem(template);

  // 更新配置到全局状态
  updateConfig(result.config);

  // 显示成功提示
  toast.success('应用成功', {
    description: `已应用${sourceName}：${templateName}`,
  });

  // 🆕 异步记录场景包使用统计
  if (result.source === 'scene_pack' && result.config.scenePackId && appUser) {
    scenePackIntegration
      .trackScenePackUsage(result.config.scenePackId, appUser.id, {
        appliedConfig: result.config,
      })
      .catch((err) => {
        console.error('记录场景包使用失败:', err);
      });
  }
};
```

**关键要点**:
- 使用 `.catch()` 异步处理，不阻塞主流程
- 仅记录场景包（`source === 'scene_pack'`）
- 需要用户登录（`appUser` 存在）
- 记录应用的完整配置（`appliedConfig`）

---

### 4. 场景包数据同步

#### 同步的 8 个官方场景包

迁移脚本 `03_scene_pack_usage_and_sync.sql` 将以下场景包同步到数据库：

| ID | 名称 | 分类 | 推荐模型 | 推荐宽高比 |
|---|---|---|---|---|
| `sp-portrait-professional` | 专业人像 | portrait | flux-dev | 3:4 |
| `sp-landscape-nature` | 自然风光 | landscape | flux-dev | 16:9 |
| `sp-art-chinese` | 中国风艺术 | art | flux-dev | 4:3 |
| `sp-art-cyberpunk` | 赛博朋克 | art | flux-dev | 16:9 |
| `sp-product-commercial` | 商业产品 | product | flux-schnell | 1:1 |
| `sp-anime-character` | 动漫人物 | anime | flux-dev | 3:4 |
| `sp-art-oil-painting` | 油画风格 | art | flux-dev | 4:3 |
| `sp-design-minimal` | 现代简约设计 | design | flux-schnell | 16:9 |

**同步策略**:
- 使用固定 UUID（基于场景包 ID 生成）
- `ON CONFLICT (id) DO UPDATE` 确保幂等性
- 完整同步所有字段（包括推荐配置）
- 设置 `is_official = true`

---

## 文件变更清单

### 新增文件

1. **`database/migrations/03_scene_pack_usage_and_sync.sql`** (600+ 行)
   - 场景包数据同步
   - 使用统计表创建
   - 视图和函数定义

2. **`P1_FIX_SUMMARY.md`** (本文档)
   - P1 修复总结文档

3. **`P1_FIX_TESTING_GUIDE.md`** (待创建)
   - P1 修复测试指南

### 修改文件

1. **`frontend/src/services/business/scenePackIntegrationService.ts`**
   - 新增 `trackScenePackUsage()` 方法（真实数据库持久化）
   - 新增 `getScenePackStats()` 方法
   - 新增 `getPopularScenePacks()` 方法
   - 新增 `ScenePackStats` 类型定义

2. **`frontend/src/App.tsx`** (第 172-180 行)
   - 集成场景包使用追踪
   - 异步记录使用统计

3. **`frontend/src/services/business/index.ts`**
   - 导出 `ScenePackStats` 类型

---

## 测试验证

### 数据库迁移测试

```bash
# 执行迁移脚本
psql -U your_user -d your_database -f database/migrations/03_scene_pack_usage_and_sync.sql

# 验证场景包同步
SELECT id, name, category, is_official FROM scene_templates WHERE is_official = true;
# 预期: 8 条记录

# 验证统计表创建
\d scene_pack_usage
# 预期: 显示表结构

# 验证视图创建
\d v_scene_pack_stats
# 预期: 显示视图定义

# 验证函数创建
\df record_scene_pack_usage
\df get_popular_scene_packs
\df get_user_scene_pack_history
# 预期: 显示函数定义
```

### 前端功能测试

详见 `P1_FIX_TESTING_GUIDE.md`

---

## 性能优化

### 索引优化

```sql
-- 场景包 ID 索引（高频查询）
CREATE INDEX idx_scene_pack_usage_scene_pack_id
ON scene_pack_usage(scene_pack_id);

-- 用户 ID 索引（用户历史查询）
CREATE INDEX idx_scene_pack_usage_user_id
ON scene_pack_usage(user_id);

-- 时间索引（时间范围查询）
CREATE INDEX idx_scene_pack_usage_used_at
ON scene_pack_usage(used_at DESC);

-- 成功率查询索引
CREATE INDEX idx_scene_pack_usage_was_successful
ON scene_pack_usage(was_successful)
WHERE was_successful IS NOT NULL;
```

### 视图性能

- `v_scene_pack_stats` 使用 `LEFT JOIN` 和聚合函数
- 预期查询时间: < 100ms（对于 10 万条使用记录）
- 考虑创建物化视图（如果数据量大）

---

## 安全性考虑

### 数据验证

```sql
-- 评分范围验证
ALTER TABLE scene_pack_usage
ADD CONSTRAINT scene_pack_usage_rating_check
CHECK (user_rating >= 1 AND user_rating <= 5);

-- 外键约束
ALTER TABLE scene_pack_usage
ADD CONSTRAINT scene_pack_usage_scene_pack_id_fkey
FOREIGN KEY (scene_pack_id) REFERENCES scene_templates(id) ON DELETE CASCADE;
```

### 权限控制

```sql
-- Row Level Security (RLS) 策略
ALTER TABLE scene_pack_usage ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的使用记录
CREATE POLICY "用户可以查看自己的使用记录"
ON scene_pack_usage FOR SELECT
USING (auth.uid() = user_id);

-- 用户可以插入自己的使用记录
CREATE POLICY "用户可以记录使用"
ON scene_pack_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## 后续优化建议

### P1.5 优化（可选）

1. **缓存优化**
   - 使用 Redis 缓存热门场景包查询结果（TTL: 5 分钟）
   - 缓存用户最近使用的场景包

2. **统计分析**
   - 添加每日/每周/每月使用趋势分析
   - 分类别统计（人像、风景、艺术等）

3. **用户行为分析**
   - 记录用户从应用到生成的完整流程
   - 分析场景包与生成成功率的关联

4. **数据导出**
   - 提供管理员数据导出功能
   - CSV/JSON 格式导出统计报表

---

## 遗留问题

### 已知限制

1. **匿名用户统计**
   - 当前匿名用户（`user_id = null`）的使用也会被记录
   - 无法关联到具体用户行为
   - 建议：考虑使用设备指纹作为匿名用户标识

2. **历史数据迁移**
   - 历史的生成记录没有关联场景包信息
   - 无法回溯分析过去的使用情况
   - 建议：从生成配置的 `scenePackId` 字段回填

3. **统计实时性**
   - `v_scene_pack_stats` 视图是实时计算的
   - 大数据量时可能影响性能
   - 建议：考虑物化视图 + 定时刷新

---

## 总结

### 修复成果

✅ **功能完整性**: 场景包使用统计从"只有日志"升级到"完整持久化"
✅ **数据一致性**: 8 个硬编码场景包已同步到数据库
✅ **可观测性**: 提供完整的统计视图和查询函数
✅ **可扩展性**: 设计支持未来的评分、反馈、推荐功能

### 技术亮点

- 🎯 **幂等性设计**: 迁移脚本可以重复执行
- 🚀 **性能优化**: 合理的索引设计支持高频查询
- 🔒 **安全可靠**: RLS 策略保护用户数据
- 📊 **智能排序**: 热度评分算法综合多个维度

### 下一步

继续处理 P1 优先级的其他问题：
- P1-3: 添加场景包预览图和示例图片
- P1-4: 实现场景包搜索和筛选功能

---

**文档版本**: v1.0
**最后更新**: 2025-11-21
**维护者**: Claude Code
