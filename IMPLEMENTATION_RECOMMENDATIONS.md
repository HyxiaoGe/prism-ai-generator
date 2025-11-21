# 实施建议与改进路线图

## 一、立即可实施的改进（P0）

### 1. 添加关键数据库索引

**优先级**：立即执行
**预期收益**：查询性能提升 50-300%

```sql
-- 1. 认证相关（影响：每次登录）
CREATE INDEX IF NOT EXISTS idx_auth_provider_id 
  ON auth_accounts(provider, provider_user_id);

-- 2. 用户生成记录查询（影响：个人主页加载）
CREATE INDEX IF NOT EXISTS idx_gen_user_date
  ON generations(user_id, created_at DESC)
  INCLUDE (status, is_public);

-- 3. 公开记录查询（影响：发现页面）
CREATE INDEX IF NOT EXISTS idx_gen_public_status
  ON generations(is_public, status, created_at DESC);

-- 4. 反馈查询（影响：统计和分析）
CREATE INDEX IF NOT EXISTS idx_feedback_gen_user
  ON image_feedback(generation_id, user_id)
  INCLUDE (feedback_type);

-- 5. 标签统计查询（影响：推荐系统）
CREATE INDEX IF NOT EXISTS idx_tag_stats_cat_count
  ON tag_stats(tag_category, usage_count DESC)
  INCLUDE (success_rate, average_rating);

-- 6. 模板查询（影响：模板浏览）
CREATE INDEX IF NOT EXISTS idx_template_status_count
  ON scene_templates(status, is_public, usage_count DESC)
  INCLUDE (rating);

-- 验证索引
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

**验证脚本**：
```typescript
// 查询执行时间对比
async function benchmarkQueries() {
  console.time('Get user generations (before index)');
  const gens = await repo.findByUserId(userId, 50);
  console.timeEnd('Get user generations (before index)');
  
  // 应该减少至少 80%
}
```

### 2. 实现错误重试机制

**优先级**：立即执行  
**代码位置**：`frontend/src/services/business/`

```typescript
// 通用重试工具
export class RetryHelper {
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      delayMs?: number;
      backoffMultiplier?: number;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delayMs = 100,
      backoffMultiplier = 2
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // 只重试临时性错误
        if (!isRetryableError(error)) throw error;
        
        // 计算延迟（指数退避）
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise(r => setTimeout(r, delay));
        
        console.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
          error
        );
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}

// 使用示例
async saveGenerationWithRetry(generation) {
  return RetryHelper.withRetry(
    () => generationRepo.save(generation),
    { maxRetries: 3, delayMs: 100 }
  );
}

function isRetryableError(error: any): boolean {
  // 网络错误、超时、暂时故障
  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'PostgresError' // Supabase 连接错误
  ];
  
  return retryableCodes.some(code => 
    error.message?.includes(code) || error.code === code
  );
}
```

### 3. 添加基础监控告警

**优先级**：立即执行  
**工具**：集成 Sentry 或类似服务

```typescript
// 初始化监控
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// 监控关键操作
async function monitoredGenerationSave(generation) {
  const transaction = Sentry.startTransaction({
    op: "db.save",
    name: "Save Generation",
  });

  try {
    const result = await generationRepo.save(generation);
    transaction.finish();
    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        operation: 'save_generation',
        model: generation.model_name,
      },
      contexts: {
        generation: {
          model_name: generation.model_name,
          model_cost: generation.model_cost,
          tags_count: generation.tags_used?.length || 0,
        },
      },
    });
    throw error;
  }
}

// 定期性能检查
async function performanceCheck() {
  const metrics = {
    avgQueryTime: 0,
    p95QueryTime: 0,
    slowQueries: 0,
  };
  
  // 上报给监控系统
  Sentry.captureMessage('Performance Check', 'info', {
    contexts: { performance: metrics }
  });
}
```

---

## 二、短期改进（P1 - 本月内）

### 1. 重构异步操作使用数据库函数

**当前问题**：
```typescript
// 异步操作可能失败且无回滚
async saveGeneration(params) {
  const generation = await generationRepository.save(params);
  
  // 这两个操作如果失败，不会回滚 generation 的创建
  this.updateDailyStats().catch(e => console.error(e));
  this.tagRepository.upsertMany(params.tags_used).catch(e => console.error(e));
  
  return generation;
}
```

**改进方案**：使用 Supabase RPC

```sql
-- 创建存储过程处理完整事务
CREATE OR REPLACE FUNCTION save_generation_with_stats(
  p_user_id UUID,
  p_prompt TEXT,
  p_model_name TEXT,
  p_model_cost NUMERIC,
  p_image_urls TEXT[],
  p_tags_used JSONB
)
RETURNS TABLE (generation_id UUID, success BOOLEAN) AS $$
DECLARE
  v_generation_id UUID;
BEGIN
  -- 1. 保存生成记录
  INSERT INTO generations (
    user_id, prompt, model_name, model_cost, 
    image_urls, tags_used
  ) VALUES (
    p_user_id, p_prompt, p_model_name, p_model_cost,
    p_image_urls, p_tags_used
  ) RETURNING id INTO v_generation_id;

  -- 2. 更新每日统计
  INSERT INTO daily_stats (date, total_generations, total_users, total_cost)
  VALUES (CURRENT_DATE, 1, 1, p_model_cost)
  ON CONFLICT (date) DO UPDATE SET
    total_generations = daily_stats.total_generations + 1,
    total_cost = daily_stats.total_cost + p_model_cost;

  -- 3. 批量更新标签统计
  INSERT INTO tag_stats (
    tag_name, tag_category, tag_value, usage_count, last_used
  )
  SELECT
    jsonb_object_keys(p_tags_used) ->> 'name',
    jsonb_object_keys(p_tags_used) ->> 'category',
    jsonb_object_keys(p_tags_used) ->> 'value',
    1,
    NOW()
  ON CONFLICT (tag_name, tag_category) DO UPDATE SET
    usage_count = tag_stats.usage_count + 1,
    last_used = NOW();

  RETURN QUERY SELECT v_generation_id, true;
  
EXCEPTION WHEN OTHERS THEN
  -- 整个事务自动回滚
  RETURN QUERY SELECT NULL::UUID, false;
END;
$$ LANGUAGE plpgsql;

-- TypeScript 调用
async saveGenerationWithAllUpdates(generation) {
  const { data, error } = await supabase
    .rpc('save_generation_with_stats', {
      p_user_id: userId,
      p_prompt: generation.prompt,
      p_model_name: generation.model_name,
      p_model_cost: generation.model_cost,
      p_image_urls: generation.image_urls,
      p_tags_used: generation.tags_used,
    });

  if (error) throw error;
  if (!data[0].success) throw new Error('Generation save failed');
  
  return { id: data[0].generation_id };
}
```

### 2. 实现完整缓存预热策略

**目标**：减少首页加载时间 50%

```typescript
// 缓存预热管理器
class CacheWarmupManager {
  async warmupOnAppStart() {
    console.log('🔥 开始缓存预热...');
    
    const startTime = performance.now();
    
    // 并行预热多个数据源
    await Promise.all([
      this.warmupUserData(),
      this.warmupHotTemplates(),
      this.warmupPopularTags(),
      this.warmupAIModels(),
    ]);
    
    const duration = performance.now() - startTime;
    console.log(`✅ 缓存预热完成 (${duration.toFixed(0)}ms)`);
  }

  private async warmupUserData() {
    try {
      const user = await userService.getOrCreateUser();
      console.log('✓ 用户数据已缓存');
    } catch (e) {
      console.error('用户数据预热失败:', e);
    }
  }

  private async warmupHotTemplates() {
    try {
      // 缓存热门模板
      await sceneTemplateService.getAllTemplates('popular');
      console.log('✓ 热门模板已缓存');
    } catch (e) {
      console.error('模板预热失败:', e);
    }
  }

  private async warmupPopularTags() {
    try {
      // 缓存每个分类的热门标签
      const categories = [
        'art_style', 'theme_style', 'mood',
        'technical', 'composition', 'enhancement'
      ];
      
      await Promise.all(
        categories.map(cat =>
          tagService.getPopularTags(cat, 10)
        )
      );
      console.log('✓ 热门标签已缓存');
    } catch (e) {
      console.error('标签预热失败:', e);
    }
  }

  private async warmupAIModels() {
    try {
      await configService.getAIModels();
      console.log('✓ AI模型已缓存');
    } catch (e) {
      console.error('模型预热失败:', e);
    }
  }
}

// App.tsx 中使用
useEffect(() => {
  const warmupManager = new CacheWarmupManager();
  warmupManager.warmupOnAppStart();
}, []);
```

### 3. 添加慢查询分析

**目标**：识别并优化性能瓶颈

```typescript
// 查询性能监控
class QueryProfiler {
  private static queries: QueryMetric[] = [];

  static profile<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    return async () => {
      const start = performance.now();
      const startMemory = (performance as any).memory?.usedJSHeapSize;

      try {
        const result = await queryFn();
        const duration = performance.now() - start;
        const memory = (performance as any).memory?.usedJSHeapSize;

        this.queries.push({
          operation,
          duration,
          memoryDelta: memory - startMemory,
          timestamp: new Date(),
          success: true,
        });

        if (duration > 500) {
          console.warn(`⚠️ 慢查询警告: ${operation} (${duration.toFixed(0)}ms)`);
        }

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        this.queries.push({
          operation,
          duration,
          timestamp: new Date(),
          success: false,
          error: (error as Error).message,
        });

        throw error;
      }
    };
  }

  static generateReport() {
    const report = {
      totalQueries: this.queries.length,
      averageTime: this.queries.reduce((s, q) => s + q.duration, 0) / this.queries.length,
      slowestQueries: this.queries
        .filter(q => q.duration > 500)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      errorRate: this.queries.filter(q => !q.success).length / this.queries.length,
    };

    console.table(report.slowestQueries);
    return report;
  }
}

// 使用示例
const users = await QueryProfiler.profile(
  'getPublicGenerations',
  () => generationService.getPublicGenerations(100)
);
```

---

## 三、中期改进（P2 - 下个月）

### 1. 全文搜索实现

**当前**：ILIKE 模糊搜索
**改进**：使用 PostgreSQL 全文搜索

```sql
-- 创建全文索引
CREATE INDEX idx_template_name_fts
  ON scene_templates
  USING GIN (to_tsvector('chinese', name));

CREATE INDEX idx_template_desc_fts
  ON scene_templates
  USING GIN (to_tsvector('chinese', COALESCE(description, '')));

-- 搜索查询
SELECT 
  id, name, category, rating, usage_count,
  ts_rank(
    to_tsvector('chinese', name || ' ' || COALESCE(description, '')),
    plainto_tsquery('chinese', 'cyberpunk')
  ) as relevance
FROM scene_templates
WHERE to_tsvector('chinese', name || ' ' || COALESCE(description, ''))
  @@ plainto_tsquery('chinese', 'cyberpunk')
ORDER BY relevance DESC
LIMIT 20;
```

### 2. 推荐算法增强

```typescript
// 混合推荐系统
class HybridRecommender {
  /**
   * 协同过滤：找相似用户，推荐他们喜欢的
   */
  async getCollaborativeRecommendations(userId: string) {
    // 1. 找用户交互过的标签
    const userTags = await getUserInteractedTags(userId);
    
    // 2. 找其他交互相似标签的用户
    const similarUsers = await findSimilarUsers(userId, userTags);
    
    // 3. 获取他们喜欢的模板
    const recommendations = await getTemplatesLikedBy(similarUsers);
    
    return recommendations;
  }

  /**
   * 内容推荐：基于用户历史，推荐相似内容
   */
  async getContentBasedRecommendations(userId: string) {
    // 1. 获取用户交互的模板
    const userTemplates = await getUserTemplateHistory(userId);
    
    // 2. 计算用户偏好向量
    const userProfile = this.buildUserProfile(userTemplates);
    
    // 3. 找相似模板
    const recommendations = await findSimilarTemplates(userProfile);
    
    return recommendations;
  }

  /**
   * 混合推荐：加权综合
   */
  async getHybridRecommendations(
    userId: string,
    weights = { collaborative: 0.5, contentBased: 0.5 }
  ) {
    const [collab, content] = await Promise.all([
      this.getCollaborativeRecommendations(userId),
      this.getContentBasedRecommendations(userId),
    ]);

    return this.mergeRecommendations(
      collab,
      content,
      weights
    );
  }

  private buildUserProfile(templates: SceneTemplate[]): UserProfile {
    // 计算用户在各个维度的偏好向量
    return {
      categoryScore: this.calculateCategoryScores(templates),
      difficultyPreference: this.calculateDifficultyPreference(templates),
      tagsAffinity: this.calculateTagAffinity(templates),
      ratingThreshold: this.calculateMinRating(templates),
    };
  }

  private mergeRecommendations(
    collab: Recommendation[],
    content: Recommendation[],
    weights: Record<string, number>
  ): Recommendation[] {
    const scoreMap = new Map<string, number>();

    // 累积协同过滤分数
    collab.forEach(rec => {
      scoreMap.set(
        rec.id,
        (scoreMap.get(rec.id) || 0) + rec.score * weights.collaborative
      );
    });

    // 累积内容推荐分数
    content.forEach(rec => {
      scoreMap.set(
        rec.id,
        (scoreMap.get(rec.id) || 0) + rec.score * weights.contentBased
      );
    });

    return Array.from(scoreMap.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}
```

### 3. 多语言支持基础设施

```typescript
// 多语言翻译系统
interface TranslationRecord {
  id: string;
  table_name: 'tags' | 'scene_templates' | 'ai_models';
  record_id: string;
  language: 'zh' | 'en' | 'ja' | 'ko';
  field_name: string;
  translated_value: string;
  is_auto_translated: boolean;
  confidence: number;
}

class I18nManager {
  async getTranslated(
    type: string,
    recordId: string,
    field: string,
    language: string = 'zh'
  ): Promise<string> {
    // 1. 查询已有翻译
    const translation = await translationRepo.find({
      table_name: type,
      record_id: recordId,
      field_name: field,
      language,
    });

    if (translation?.confidence > 0.9) {
      return translation.translated_value;
    }

    // 2. 如果没有高质量翻译，使用LLM生成
    if (!translation) {
      const original = await getOriginalValue(type, recordId, field);
      const translated = await this.translateWithLLM(original, language);
      
      await translationRepo.save({
        table_name: type,
        record_id: recordId,
        field_name: field,
        language,
        translated_value: translated,
        is_auto_translated: true,
      });

      return translated;
    }

    return translation.translated_value;
  }

  private async translateWithLLM(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    const response = await llmService.translate(text, targetLanguage);
    return response.translated;
  }
}

// 使用示例
const tagName = await i18nManager.getTranslated(
  'tags',
  tagId,
  'label',
  'en'  // 获取英文翻译
);
```

---

## 四、长期规划（P3）

### 1. 数据库分库分表策略

**问题**：
- `generations` 表预计 1 年内增长至 36M+ 条记录（55GB）
- 单表查询和维护成本增加

**解决方案**：

```sql
-- 1. 按时间分表
CREATE TABLE generations_2024_01 PARTITION OF generations
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE generations_2024_02 PARTITION OF generations
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 2. 按用户分表（高频查询优化）
CREATE TABLE generations_user_shard_00 PARTITION OF generations
  FOR VALUES FROM ('user_00') TO ('user_10');

-- 3. 自动清理过期数据
CREATE POLICY cleanup_old_generations
  ON generations
  USING (created_at > NOW() - INTERVAL '2 years');
```

### 2. 读写分离架构

```typescript
// 数据库连接管理
class DatabaseManager {
  private writeClient: SupabaseClient;  // 主库（写）
  private readClient: SupabaseClient;   // 从库（读）

  async executeQuery<T>(
    operation: 'read' | 'write',
    query: () => Promise<T>
  ): Promise<T> {
    const client = operation === 'write' 
      ? this.writeClient 
      : this.readClient;

    // 实现客户端路由
    return await query.call({ supabase: client });
  }

  // 写操作使用主库
  async saveGeneration(generation) {
    return this.executeQuery('write', async () => {
      return await this.writeClient
        .from('generations')
        .insert(generation);
    });
  }

  // 读操作可使用从库
  async getPublicGenerations(limit: number) {
    return this.executeQuery('read', async () => {
      return await this.readClient
        .from('generations')
        .select('*')
        .eq('is_public', true)
        .limit(limit);
    });
  }
}
```

### 3. 实时推送功能

```typescript
// 使用 Supabase Realtime
class RealtimeManager {
  private subscriptions = new Map();

  // 实时监听新生成
  subscribeToGenerations(userId: string) {
    const channel = supabase
      .channel(`generations:user=${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // 新生成记录
          this.handleNewGeneration(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(`gen-${userId}`, channel);
  }

  // 实时通知
  async notifyNewComment(generationId: string, comment: string) {
    await supabase
      .from('notifications')
      .insert({
        type: 'new_comment',
        generation_id: generationId,
        message: comment,
      });

    // 实时推送给所有订阅用户
    const channel = supabase.channel(`gen:${generationId}`);
    channel.send({
      type: 'broadcast',
      event: 'comment_added',
      payload: { generationId, comment },
    });
  }

  unsubscribe(key: string) {
    this.subscriptions.get(key)?.unsubscribe();
    this.subscriptions.delete(key);
  }
}
```

---

## 五、性能目标与 SLA

### 关键指标

| 指标 | 当前 | 目标 | 优先级 |
|------|------|------|--------|
| 用户登录 | ? | < 500ms | P0 |
| 加载首页 | ? | < 1s | P0 |
| 生成图片保存 | ? | < 100ms | P0 |
| 获取推荐 | ? | < 500ms | P1 |
| 搜索模板 | ? | < 1s | P1 |
| 缓存命中率 | ? | > 70% | P2 |
| 错误率 | ? | < 0.1% | P0 |
| P95 延迟 | ? | < 2s | P1 |

### 监控仪表板（建议）

```
┌─────────────────────────────────────────┐
│      Prism AI Generator 监控面板        │
├─────────────────────────────────────────┤
│                                         │
│ 实时指标：                              │
│ ├─ 日活用户：12,345                    │
│ ├─ 生成成功率：99.8%                   │
│ ├─ 平均响应时间：245ms                 │
│ ├─ 缓存命中率：73%                     │
│ └─ 错误数：3                           │
│                                         │
│ 数据库：                               │
│ ├─ 连接使用率：45%                     │
│ ├─ 存储使用：23GB / 100GB              │
│ ├─ 慢查询数：2 (今天)                  │
│ └─ 备份状态：✓ 最后 1小时前            │
│                                         │
│ 告警：                                  │
│ ├─ ⚠️  错误率上升 (0.5%)                │
│ └─ ⚠️  缓存命中率下降 (60%)            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 六、风险评估

### 高风险项

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 并发写入冲突 | 中 | 高 | 实现乐观锁 |
| 数据不一致 | 中 | 高 | 使用RPC事务 |
| 缓存失效 | 低 | 中 | 缓存预热 |
| 查询超时 | 中 | 中 | 添加索引 |
| 存储溢出 | 低 | 高 | 分表分区 |

### 应急预案

```typescript
// 数据恢复检查清单
interface DisasterRecoveryPlan {
  // 1. 定期备份验证
  verifyBackups: async () => {
    const backup = await supabase.rpc('verify_backup_integrity');
    if (!backup.valid) {
      Sentry.captureMessage('Backup integrity check failed', 'error');
    }
  },

  // 2. 数据一致性检查
  checkConsistency: async () => {
    const issues = await supabase.rpc('check_data_consistency');
    if (issues.length > 0) {
      console.error('数据一致性问题:', issues);
      // 触发告警
    }
  },

  // 3. 快速恢复流程
  quickRestore: async (checkpoint: string) => {
    // 使用 PITR（Point In Time Recovery）
    await supabase.rpc('restore_from_backup', {
      backup_id: checkpoint,
    });
  },
}
```

---

## 总结：下一步行动

### 本周 (Week 1)
- [ ] 添加 P0 级索引
- [ ] 集成 Sentry 监控
- [ ] 实现重试机制

### 本月 (Month 1)
- [ ] 创建 RPC 事务函数
- [ ] 实现缓存预热
- [ ] 设置告警规则

### 下月 (Month 2)
- [ ] 全文搜索实现
- [ ] 推荐系统增强
- [ ] 多语言基础设施

### Q2 规划
- [ ] 分库分表实施
- [ ] 读写分离部署
- [ ] 实时推送功能

