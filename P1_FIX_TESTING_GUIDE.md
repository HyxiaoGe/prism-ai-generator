# P1 修复测试指南

本文档提供 P1 优先级修复的完整测试流程，包括数据库迁移验证、功能测试、性能测试和故障排查。

**测试范围**: 场景包使用统计持久化和数据同步
**测试优先级**: P1（高优先级）
**预计测试时间**: 30-45 分钟

---

## 📋 测试前准备

### 1. 环境要求

- ✅ PostgreSQL 数据库已连接
- ✅ Supabase 项目已配置
- ✅ 前端开发环境已启动
- ✅ 有测试用户账号（或使用匿名模式）

### 2. 备份数据

```bash
# 备份数据库（推荐）
pg_dump -U your_user -d your_database -f backup_before_p1.sql

# 或者使用 Supabase 备份功能
# Dashboard -> Settings -> Database -> Backups
```

### 3. 检查依赖

```bash
# 确认 P0 迁移已执行
SELECT COUNT(*) FROM scene_templates WHERE recommended_model IS NOT NULL;
# 预期: 应该返回 > 0 的数量

# 检查 Supabase RPC 支持
SELECT proname FROM pg_proc WHERE proname LIKE 'record_%';
# 如果返回空，说明需要先执行迁移
```

---

## 🔧 第一步：数据库迁移测试

### 1.1 执行迁移脚本

```bash
# 方式一：使用 psql 命令行
psql -U your_user -d your_database -f database/migrations/03_scene_pack_usage_and_sync.sql

# 方式二：使用 Supabase SQL Editor
# 1. 打开 Supabase Dashboard -> SQL Editor
# 2. 复制 03_scene_pack_usage_and_sync.sql 的内容
# 3. 点击 Run 执行
```

**预期输出**:
```
NOTICE:  ===================================
NOTICE:  场景包使用统计系统迁移完成！
NOTICE:  ===================================
NOTICE:  同步的场景包数量: 8
NOTICE:  创建的表: 1 (scene_pack_usage)
NOTICE:  创建的视图: 1 (v_scene_pack_stats)
NOTICE:  创建的函数: 3
NOTICE:  ===================================
```

### 1.2 验证表结构

```sql
-- 验证 scene_pack_usage 表创建
\d scene_pack_usage

-- 预期输出
                         Table "public.scene_pack_usage"
      Column       |           Type           | Collation | Nullable |      Default
-------------------+--------------------------+-----------+----------+-------------------
 id                | uuid                     |           | not null | gen_random_uuid()
 scene_pack_id     | uuid                     |           | not null |
 user_id           | uuid                     |           |          |
 generation_id     | uuid                     |           |          |
 applied_config    | jsonb                    |           |          |
 was_successful    | boolean                  |           |          |
 user_rating       | integer                  |           |          |
 used_at           | timestamp with time zone |           | not null | now()
Indexes:
    "scene_pack_usage_pkey" PRIMARY KEY, btree (id)
    "idx_scene_pack_usage_scene_pack_id" btree (scene_pack_id)
    "idx_scene_pack_usage_user_id" btree (user_id)
    "idx_scene_pack_usage_used_at" btree (used_at DESC)
```

### 1.3 验证场景包同步

```sql
-- 查询同步的官方场景包
SELECT
  id,
  name,
  category,
  recommended_model,
  recommended_aspect_ratio,
  is_official,
  status
FROM scene_templates
WHERE is_official = true
ORDER BY category, name;

-- 预期: 返回 8 条记录
-- sp-portrait-professional    | 专业人像        | portrait  | flux-dev     | 3:4
-- sp-landscape-nature         | 自然风光        | landscape | flux-dev     | 16:9
-- sp-art-chinese              | 中国风艺术      | art       | flux-dev     | 4:3
-- sp-art-cyberpunk            | 赛博朋克        | art       | flux-dev     | 16:9
-- sp-art-oil-painting         | 油画风格        | art       | flux-dev     | 4:3
-- sp-product-commercial       | 商业产品        | product   | flux-schnell | 1:1
-- sp-anime-character          | 动漫人物        | anime     | flux-dev     | 3:4
-- sp-design-minimal           | 现代简约设计    | design    | flux-schnell | 16:9
```

### 1.4 验证视图创建

```sql
-- 验证统计视图结构
\d v_scene_pack_stats

-- 查询视图数据（初始应该没有使用记录）
SELECT
  scene_pack_name,
  total_usage_count,
  success_rate,
  avg_rating,
  popularity_score
FROM v_scene_pack_stats
ORDER BY popularity_score DESC;

-- 预期: 返回 8 条记录，所有统计值为 0 或 NULL
```

### 1.5 验证函数创建

```sql
-- 查看已创建的函数
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'record_scene_pack_usage',
  'get_popular_scene_packs',
  'get_user_scene_pack_history'
);

-- 预期: 返回 3 个函数定义
```

---

## 🧪 第二步：数据库函数测试

### 2.1 测试 `record_scene_pack_usage()` 函数

```sql
-- 准备测试数据（需要先获取一个有效的场景包 ID 和用户 ID）
-- 如果没有用户，可以先创建一个测试用户
DO $$
DECLARE
  v_test_user_id UUID;
  v_scene_pack_id UUID;
  v_usage_id UUID;
BEGIN
  -- 获取第一个官方场景包的 ID
  SELECT id INTO v_scene_pack_id
  FROM scene_templates
  WHERE is_official = true
  LIMIT 1;

  -- 创建或获取测试用户（使用固定 UUID 方便测试）
  v_test_user_id := 'test-user-00000000-0000-0000-0000-000000000001'::UUID;

  INSERT INTO users (id, device_id, is_registered)
  VALUES (v_test_user_id, 'test-device-001', false)
  ON CONFLICT (id) DO NOTHING;

  -- 测试记录使用
  SELECT record_scene_pack_usage(
    p_scene_pack_id := v_scene_pack_id,
    p_user_id := v_test_user_id,
    p_applied_config := '{"model": "flux-dev", "aspectRatio": "3:4"}'::JSONB,
    p_was_successful := true,
    p_user_rating := 5
  ) INTO v_usage_id;

  RAISE NOTICE '✅ 测试成功：使用记录 ID = %', v_usage_id;
END $$;
```

**预期结果**:
```
NOTICE:  ✅ 测试成功：使用记录 ID = <some-uuid>
```

**验证数据插入**:
```sql
-- 查询刚刚插入的记录
SELECT
  id,
  scene_pack_id,
  user_id,
  was_successful,
  user_rating,
  applied_config,
  used_at
FROM scene_pack_usage
ORDER BY used_at DESC
LIMIT 5;

-- 预期: 返回刚刚插入的记录
```

### 2.2 测试评分约束

```sql
-- 测试无效评分（应该失败）
DO $$
DECLARE
  v_scene_pack_id UUID;
BEGIN
  SELECT id INTO v_scene_pack_id FROM scene_templates WHERE is_official = true LIMIT 1;

  -- 尝试插入无效评分（6 分）
  PERFORM record_scene_pack_usage(
    p_scene_pack_id := v_scene_pack_id,
    p_user_id := 'test-user-00000000-0000-0000-0000-000000000001'::UUID,
    p_user_rating := 6  -- 无效，应该抛出异常
  );

  RAISE NOTICE '❌ 测试失败：应该拒绝无效评分';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '✅ 测试通过：正确拒绝了无效评分';
END $$;
```

**预期结果**:
```
NOTICE:  ✅ 测试通过：正确拒绝了无效评分
```

### 2.3 测试 `get_popular_scene_packs()` 函数

```sql
-- 先插入一些测试数据
DO $$
DECLARE
  v_user_id UUID := 'test-user-00000000-0000-0000-0000-000000000001'::UUID;
  v_pack_id UUID;
BEGIN
  -- 为每个场景包插入几条使用记录
  FOR v_pack_id IN
    SELECT id FROM scene_templates WHERE is_official = true
  LOOP
    -- 每个场景包插入 3-10 条随机使用记录
    FOR i IN 1..(3 + floor(random() * 8)::int) LOOP
      PERFORM record_scene_pack_usage(
        p_scene_pack_id := v_pack_id,
        p_user_id := v_user_id,
        p_was_successful := (random() > 0.2),  -- 80% 成功率
        p_user_rating := (1 + floor(random() * 5)::int)  -- 1-5 随机评分
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ 测试数据已插入';
END $$;
```

**查询热门场景包**:
```sql
-- 获取最近 30 天的热门场景包（Top 5）
SELECT * FROM get_popular_scene_packs(5, 30);

-- 预期: 返回 5 条记录，按 popularity_score 降序排列
-- 检查点：
-- 1. usage_count > 0
-- 2. success_rate 在 0-100 之间
-- 3. popularity_score 有合理的值
```

### 2.4 测试 `get_user_scene_pack_history()` 函数

```sql
-- 查询测试用户的使用历史
SELECT
  scene_pack_name,
  used_at,
  was_successful,
  user_rating
FROM get_user_scene_pack_history(
  'test-user-00000000-0000-0000-0000-000000000001'::UUID,
  10
);

-- 预期: 返回该用户的最近 10 条使用记录
-- 检查点：
-- 1. 按 used_at 降序排列
-- 2. scene_pack_name 不为空
-- 3. 数量 <= 10
```

---

## 🎨 第三步：前端功能测试

### 3.1 启动前端开发环境

```bash
cd frontend
npm run dev

# 或使用 Netlify Dev（推荐）
cd ..
netlify dev
```

**访问**: http://localhost:8888（或 5173）

### 3.2 测试场景包应用和追踪

**测试步骤**:

1. **打开浏览器开发者工具**
   - 按 F12 打开 Console
   - 切换到 Network 标签

2. **登录或创建用户**
   - 如果需要，先创建一个测试账号
   - 或使用匿名模式（某些功能可能不可用）

3. **应用场景包**
   - 在主界面找到"场景包"或"模板"区域
   - 点击任意场景包（例如"专业人像"）
   - 观察 Console 输出

**预期 Console 输出**:
```
[ScenePackIntegrationService] 应用场景包: 专业人像 (sp-portrait-professional)
✅ 场景包应用成功: {
  source: "scene_pack",
  basePrompt: "...",
  fullPrompt: "...",
  config: {
    scenePackId: "sp-portrait-professional",
    model: "flux-dev",
    aspectRatio: "3:4",
    ...
  }
}
✅ 场景包使用已记录: {
  scenePackId: "sp-portrait-professional",
  userId: "<user-id>",
  usageId: "<usage-id>"
}
```

**预期 Network 请求**:
- 应该看到一个 POST 请求到 Supabase RPC 端点
- 请求路径: `/rest/v1/rpc/record_scene_pack_usage`
- 请求体包含场景包信息和用户 ID

### 3.3 验证数据库记录

```sql
-- 查询最新的使用记录
SELECT
  sp.name as scene_pack_name,
  u.used_at,
  u.applied_config->>'model' as applied_model,
  u.applied_config->>'aspectRatio' as applied_aspect_ratio
FROM scene_pack_usage u
INNER JOIN scene_templates sp ON sp.id = u.scene_pack_id
ORDER BY u.used_at DESC
LIMIT 10;

-- 预期: 应该看到刚刚应用的场景包记录
-- 检查点：
-- 1. scene_pack_name 与前端点击的一致
-- 2. applied_model 和 applied_aspect_ratio 有值
-- 3. used_at 是刚刚的时间
```

### 3.4 测试统计数据更新

```sql
-- 查看实时统计
SELECT
  scene_pack_name,
  total_usage_count,
  unique_user_count,
  success_rate,
  avg_rating,
  popularity_score
FROM v_scene_pack_stats
WHERE total_usage_count > 0
ORDER BY popularity_score DESC;

-- 预期:
-- 1. 刚刚使用的场景包 total_usage_count 增加了 1
-- 2. unique_user_count 增加了（如果是新用户首次使用该场景包）
-- 3. popularity_score 有更新
```

### 3.5 测试多次应用

**测试步骤**:
1. 连续应用同一个场景包 3 次
2. 应用不同的场景包 2 次
3. 查看统计数据变化

**验证查询**:
```sql
-- 按场景包统计使用次数
SELECT
  sp.name,
  COUNT(*) as usage_count,
  COUNT(DISTINCT u.user_id) as unique_users
FROM scene_pack_usage u
INNER JOIN scene_templates sp ON sp.id = u.scene_pack_id
WHERE u.used_at >= NOW() - INTERVAL '1 hour'
GROUP BY sp.id, sp.name
ORDER BY usage_count DESC;

-- 预期: 统计数量与前端操作次数一致
```

---

## 📊 第四步：统计功能测试

### 4.1 测试热门场景包查询

**前端代码测试**（浏览器 Console）:
```javascript
// 获取热门场景包
const scenePackIntegration = window.__scenePackIntegration; // 如果暴露了全局对象
const popularPacks = await scenePackIntegration.getPopularScenePacks(5, 30);
console.log('热门场景包:', popularPacks);

// 预期: 返回数组，按 popularity_score 降序排列
// [
//   { id: '...', name: '专业人像', stats: { usageCount: 15, ... } },
//   ...
// ]
```

**直接数据库查询**:
```sql
SELECT * FROM get_popular_scene_packs(5, 30);

-- 预期: 返回 5 条记录（如果有 5 个以上的场景包被使用）
```

### 4.2 测试场景包统计查询

**前端代码测试**:
```javascript
// 查询单个场景包的统计
const stats = await scenePackIntegration.getScenePackStats('sp-portrait-professional');
console.log('场景包统计:', stats);

// 预期输出:
// {
//   usageCount: 15,
//   successRate: 85.5,
//   avgRating: 4.3,
//   ratingCount: 10,
//   lastUsed: Date,
//   popularityScore: 123.45
// }
```

**数据库验证**:
```sql
SELECT * FROM v_scene_pack_stats
WHERE scene_pack_id = 'sp-portrait-professional';

-- 预期: 与前端返回的数据一致
```

### 4.3 测试时间范围过滤

```sql
-- 测试不同时间范围
SELECT scene_pack_name, usage_count
FROM get_popular_scene_packs(10, 1)  -- 最近 1 天
ORDER BY usage_count DESC;

SELECT scene_pack_name, usage_count
FROM get_popular_scene_packs(10, 7)  -- 最近 7 天
ORDER BY usage_count DESC;

SELECT scene_pack_name, usage_count
FROM get_popular_scene_packs(10, 30)  -- 最近 30 天
ORDER BY usage_count DESC;

-- 检查点：
-- 1. 数量随时间范围扩大而增加或保持不变
-- 2. 排序正确
```

---

## ⚡ 第五步：性能测试

### 5.1 批量插入测试

```sql
-- 插入 1000 条测试数据
DO $$
DECLARE
  v_user_id UUID;
  v_pack_ids UUID[];
  v_pack_id UUID;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  -- 获取所有场景包 ID
  SELECT ARRAY_AGG(id) INTO v_pack_ids
  FROM scene_templates WHERE is_official = true;

  -- 创建测试用户
  INSERT INTO users (id, device_id)
  VALUES (gen_random_uuid(), 'perf-test-device')
  RETURNING id INTO v_user_id;

  start_time := clock_timestamp();

  -- 插入 1000 条记录
  FOR i IN 1..1000 LOOP
    v_pack_id := v_pack_ids[1 + floor(random() * array_length(v_pack_ids, 1))];

    PERFORM record_scene_pack_usage(
      p_scene_pack_id := v_pack_id,
      p_user_id := v_user_id,
      p_was_successful := (random() > 0.2),
      p_user_rating := (1 + floor(random() * 5)::int)
    );
  END LOOP;

  end_time := clock_timestamp();

  RAISE NOTICE '✅ 插入 1000 条记录耗时: % ms',
    EXTRACT(MILLISECONDS FROM (end_time - start_time));
END $$;

-- 预期: < 5000ms（5 秒）
```

### 5.2 查询性能测试

```sql
-- 测试统计视图查询性能
EXPLAIN ANALYZE
SELECT * FROM v_scene_pack_stats;

-- 检查点：
-- 1. Planning Time < 10ms
-- 2. Execution Time < 100ms（对于 1000+ 条记录）
-- 3. 使用了索引（Bitmap Index Scan 或 Index Scan）

-- 测试热门查询性能
EXPLAIN ANALYZE
SELECT * FROM get_popular_scene_packs(10, 30);

-- 检查点：
-- 1. Execution Time < 50ms
```

### 5.3 索引效率验证

```sql
-- 验证索引是否被使用
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM scene_pack_usage
WHERE scene_pack_id = 'sp-portrait-professional';

-- 预期: Index Scan using idx_scene_pack_usage_scene_pack_id

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM scene_pack_usage
WHERE user_id = 'test-user-00000000-0000-0000-0000-000000000001'::UUID;

-- 预期: Index Scan using idx_scene_pack_usage_user_id
```

---

## 🔍 第六步：边界情况测试

### 6.1 测试匿名用户（user_id = NULL）

```sql
-- 插入匿名使用记录
SELECT record_scene_pack_usage(
  p_scene_pack_id := (SELECT id FROM scene_templates WHERE is_official = true LIMIT 1),
  p_user_id := NULL,  -- 匿名用户
  p_was_successful := true
);

-- 验证插入成功
SELECT * FROM scene_pack_usage WHERE user_id IS NULL ORDER BY used_at DESC LIMIT 1;

-- 预期: 应该成功插入，user_id 为 NULL
```

### 6.2 测试部分字段缺失

```sql
-- 只提供必填字段
SELECT record_scene_pack_usage(
  p_scene_pack_id := (SELECT id FROM scene_templates WHERE is_official = true LIMIT 1)
);

-- 预期: 应该成功，其他字段为默认值或 NULL
```

### 6.3 测试无效场景包 ID

```sql
-- 尝试使用不存在的场景包 ID
DO $$
BEGIN
  PERFORM record_scene_pack_usage(
    p_scene_pack_id := '00000000-0000-0000-0000-000000000000'::UUID
  );

  RAISE NOTICE '❌ 测试失败：应该拒绝无效的场景包 ID';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✅ 测试通过：正确拒绝了无效的场景包 ID';
END $$;

-- 预期: 捕获外键约束异常
```

### 6.4 测试成功率计算

```sql
-- 插入混合成功/失败记录
DO $$
DECLARE
  v_pack_id UUID;
BEGIN
  SELECT id INTO v_pack_id FROM scene_templates WHERE is_official = true LIMIT 1;

  -- 插入 10 条记录：8 成功，2 失败
  FOR i IN 1..8 LOOP
    PERFORM record_scene_pack_usage(
      p_scene_pack_id := v_pack_id,
      p_was_successful := true
    );
  END LOOP;

  FOR i IN 1..2 LOOP
    PERFORM record_scene_pack_usage(
      p_scene_pack_id := v_pack_id,
      p_was_successful := false
    );
  END LOOP;
END $$;

-- 验证成功率计算
SELECT
  scene_pack_name,
  successful_count,
  failed_count,
  success_rate
FROM v_scene_pack_stats
WHERE successful_count + failed_count = 10;

-- 预期: success_rate = 80.00 (8/10 * 100)
```

---

## ✅ 测试检查清单

### 数据库层测试

- [ ] 迁移脚本成功执行，无错误
- [ ] `scene_pack_usage` 表创建成功，包含所有字段和索引
- [ ] 8 个官方场景包已同步到 `scene_templates` 表
- [ ] `v_scene_pack_stats` 视图创建成功
- [ ] `record_scene_pack_usage()` 函数可正常调用
- [ ] `get_popular_scene_packs()` 函数返回正确结果
- [ ] `get_user_scene_pack_history()` 函数返回正确结果
- [ ] 评分约束生效（1-5 范围）
- [ ] 外键约束生效（无效场景包 ID 被拒绝）
- [ ] 索引被正确使用（EXPLAIN ANALYZE 验证）

### 前端功能测试

- [ ] 应用场景包时，Console 显示成功日志
- [ ] Network 显示 RPC 请求到 `record_scene_pack_usage`
- [ ] 数据库中能查询到新插入的使用记录
- [ ] 应用的配置（model, aspectRatio 等）正确保存到 `applied_config`
- [ ] 统计数据实时更新（`usage_count` 增加）
- [ ] 多次应用同一场景包，统计累加正确
- [ ] 应用不同场景包，分别统计正确
- [ ] 匿名用户也能正常记录使用（如果支持）

### 统计功能测试

- [ ] `getPopularScenePacks()` 返回正确的热门场景包
- [ ] 热门度排序符合预期（popularity_score 降序）
- [ ] `getScenePackStats()` 返回正确的统计数据
- [ ] 成功率计算正确（successful / total * 100）
- [ ] 平均评分计算正确
- [ ] 时间范围过滤生效（p_days 参数）

### 性能测试

- [ ] 1000 条记录插入 < 5 秒
- [ ] 统计视图查询 < 100ms
- [ ] 热门查询 < 50ms
- [ ] 索引被正确使用

### 边界情况测试

- [ ] 匿名用户（user_id = NULL）可以记录
- [ ] 部分字段缺失时使用默认值
- [ ] 无效场景包 ID 被拒绝（外键约束）
- [ ] 无效评分被拒绝（CHECK 约束）
- [ ] 空配置可以保存（applied_config = NULL）

---

## 🐛 故障排查

### 问题 1: 迁移脚本执行失败

**症状**:
```
ERROR: relation "scene_pack_usage" already exists
```

**原因**: 迁移脚本已经执行过

**解决方案**:
```sql
-- 方案 1: 删除已创建的对象（谨慎使用！）
DROP TABLE IF EXISTS scene_pack_usage CASCADE;
DROP VIEW IF EXISTS v_scene_pack_stats CASCADE;
DROP FUNCTION IF EXISTS record_scene_pack_usage CASCADE;
DROP FUNCTION IF EXISTS get_popular_scene_packs CASCADE;
DROP FUNCTION IF EXISTS get_user_scene_pack_history CASCADE;

-- 然后重新执行迁移脚本

-- 方案 2: 检查对象是否已正确创建
\d scene_pack_usage
\d v_scene_pack_stats
\df record_scene_pack_usage
-- 如果都正常，说明迁移已完成，可以跳过
```

---

### 问题 2: RPC 调用返回 404

**症状**: 前端 Network 显示 `POST /rest/v1/rpc/record_scene_pack_usage` 返回 404

**原因**: Supabase 没有识别到函数

**解决方案**:
```sql
-- 1. 检查函数是否存在
SELECT proname FROM pg_proc WHERE proname = 'record_scene_pack_usage';

-- 2. 检查函数的 schema（应该在 public）
SELECT n.nspname, p.proname
FROM pg_proc p
INNER JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'record_scene_pack_usage';

-- 3. 如果不在 public schema，需要移动
-- （通常不会发生，迁移脚本默认在 public）

-- 4. 刷新 Supabase 缓存
-- Dashboard -> Settings -> API -> Reload schema cache
```

---

### 问题 3: 统计数据不更新

**症状**: 多次应用场景包后，`v_scene_pack_stats` 的 `total_usage_count` 仍为 0

**排查步骤**:
```sql
-- 1. 检查是否有使用记录插入
SELECT COUNT(*) FROM scene_pack_usage;

-- 2. 检查视图定义是否正确
\d+ v_scene_pack_stats

-- 3. 手动查询统计
SELECT
  sp.name,
  COUNT(u.id) as usage_count
FROM scene_templates sp
LEFT JOIN scene_pack_usage u ON u.scene_pack_id = sp.id
WHERE sp.is_official = true
GROUP BY sp.id, sp.name;

-- 4. 如果手动查询有结果，但视图没有，尝试重建视图
DROP VIEW v_scene_pack_stats;
-- 重新执行迁移脚本中的视图创建部分
```

---

### 问题 4: 前端 Console 没有日志

**症状**: 应用场景包后，Console 没有显示"场景包使用已记录"

**排查步骤**:
1. 检查 `App.tsx` 是否已更新（第 172-180 行）
2. 检查用户是否已登录（`appUser` 是否存在）
3. 检查场景包是否有 `scenePackId`（数据库模板可能没有）
4. 打开 Network 标签，查看是否有 RPC 请求
5. 如果有请求但失败，检查响应的错误信息

**手动触发测试**（浏览器 Console）:
```javascript
// 假设已暴露全局对象
const { scenePackIntegration } = window.__services;
const userId = 'test-user-id'; // 替换为实际用户 ID
const scenePackId = 'sp-portrait-professional';

scenePackIntegration.trackScenePackUsage(scenePackId, userId, {
  appliedConfig: { model: 'flux-dev', aspectRatio: '3:4' }
})
.then(() => console.log('✅ 手动测试成功'))
.catch(err => console.error('❌ 手动测试失败:', err));
```

---

### 问题 5: 热度评分异常

**症状**: 某些场景包的 `popularity_score` 为 0 或异常大

**排查步骤**:
```sql
-- 1. 检查原始数据
SELECT
  sp.name,
  COUNT(u.id) as usage_count,
  COUNT(CASE WHEN u.was_successful = true THEN 1 END) as successful_count,
  COUNT(CASE WHEN u.was_successful IS NOT NULL THEN 1 END) as has_result_count,
  AVG(u.user_rating) as avg_rating
FROM scene_templates sp
LEFT JOIN scene_pack_usage u ON u.scene_pack_id = sp.id
WHERE sp.is_official = true
GROUP BY sp.id, sp.name;

-- 2. 手动计算热度评分
-- popularity_score = usage_count * 0.5 + success_rate * 100 * 0.3 + avg_rating * 20 * 0.2

-- 3. 如果公式有误，更新视图定义
-- 修改 03_scene_pack_usage_and_sync.sql 中的公式，然后重建视图
```

---

## 📝 测试报告模板

```markdown
# P1 修复测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: [姓名]
**测试环境**: [开发/测试/生产]

## 测试结果概览

- ✅ 数据库迁移: 通过 / ❌ 失败
- ✅ 函数测试: 通过 / ❌ 失败
- ✅ 前端功能: 通过 / ❌ 失败
- ✅ 统计查询: 通过 / ❌ 失败
- ✅ 性能测试: 通过 / ❌ 失败

## 详细测试记录

### 1. 数据库迁移
- 场景包同步: [✅/❌] [数量: 8]
- 表创建: [✅/❌]
- 视图创建: [✅/❌]
- 函数创建: [✅/❌]

### 2. 功能测试
- 记录使用: [✅/❌]
- 查询统计: [✅/❌]
- 热门排序: [✅/❌]
- 用户历史: [✅/❌]

### 3. 性能测试
- 1000 条插入耗时: [X] ms
- 统计查询耗时: [X] ms
- 热门查询耗时: [X] ms

## 发现的问题

1. [问题描述]
   - 严重程度: [高/中/低]
   - 影响范围: [...]
   - 解决方案: [...]

## 测试结论

[通过/不通过] - [整体评价]

## 建议

1. [...]
2. [...]
```

---

## 🎯 测试完成标准

当以下所有条件满足时，P1 修复测试通过：

1. ✅ 数据库迁移无错误执行
2. ✅ 8 个场景包已同步到数据库
3. ✅ 所有数据库函数正常工作
4. ✅ 前端可以成功记录使用统计
5. ✅ 统计数据实时更新且准确
6. ✅ 热门场景包查询返回合理结果
7. ✅ 性能测试达到预期指标
8. ✅ 边界情况处理正确
9. ✅ 无已知的阻塞性 bug

---

## 📞 获取帮助

如果测试过程中遇到问题：

1. **检查日志**: 查看 PostgreSQL 日志和前端 Console
2. **查阅文档**: 参考 `P1_FIX_SUMMARY.md`
3. **数据库调试**: 使用 `EXPLAIN ANALYZE` 分析慢查询
4. **回滚数据**: 使用之前的备份恢复数据库

---

**文档版本**: v1.0
**最后更新**: 2025-11-21
**维护者**: Claude Code
