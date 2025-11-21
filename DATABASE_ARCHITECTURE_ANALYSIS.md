# Prism AI Generator - Supabase数据库设计与服务层架构深入分析

## 目录
1. [数据库架构概览](#数据库架构概览)
2. [ER图分析](#er图分析)
3. [Repository层分析](#repository层分析)
4. [Service层分析](#service层分析)
5. [数据流程图](#数据流程图)
6. [关键SQL查询示例](#关键sql查询示例)
7. [数据一致性机制](#数据一致性机制)
8. [性能分析与优化建议](#性能分析与优化建议)
9. [扩展性建议](#扩展性建议)

---

## 数据库架构概览

### 表统计
**总表数**：20个表，分为5个类别

### 表分类
```
┌─────────────────────────────────────────────────────────────┐
│                     数据库表分类体系                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 认证与用户管理 (2个表)                                    │
│    ├─ users (核心用户表)                                    │
│    └─ auth_accounts (多认证方式支持)                        │
│                                                             │
│ 2. 配置与元数据 (4个表)                                     │
│    ├─ tags (标签定义)                                      │
│    ├─ ai_models (模型配置)                                 │
│    ├─ scene_templates (场景模板)                           │
│    └─ user_template_favorites (用户收藏)                   │
│                                                             │
│ 3. 业务数据 (6个表)                                        │
│    ├─ generations (生成记录)                               │
│    ├─ image_feedback (图片反馈)                            │
│    ├─ prompt_translations (翻译缓存)                       │
│    ├─ prompt_stats (提示词统计)                            │
│    ├─ tag_stats (标签统计)                                 │
│    └─ daily_stats (每日统计)                               │
│                                                             │
│ 4. 模板评价体系 (3个表)                                    │
│    ├─ template_ratings (评分)                              │
│    ├─ template_usage_history (使用历史)                    │
│    └─ (belongs to scene_templates)                         │
│                                                             │
│ 5. 推荐系统 (5个表)                                        │
│    ├─ user_events (用户事件)                               │
│    ├─ user_preferences (用户偏好)                          │
│    ├─ recommendations (推荐记录)                           │
│    ├─ recommendation_interactions (推荐交互)               │
│    ├─ popular_items (热门内容)                             │
│    ├─ experiments (A/B测试)                                │
│    └─ user_experiment_assignments (实验分组)               │
└─────────────────────────────────────────────────────────────┘
```

---

## ER图分析

### 1. 核心关系图

```
┌──────────────────────────────────────────────────────────────────────┐
│                         认证与用户管理域                              │
└──────────────────────────────────────────────────────────────────────┘

                            ┌─────────────┐
                            │    users    │
                            ├─────────────┤
                            │ id (PK)     │
                            │ display_name│
                            │ email       │
                            │ avatar_url  │
                            │ daily_quota │
                            │ used_today  │
                            │ total_gen.. │
                            │ created_at  │
                            │ updated_at  │
                            └──────┬──────┘
                                   │ 1:N
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────▼─────────┐      ┌───────────▼────────┐
         │  auth_accounts     │      │    generations     │
         ├──────────────────┤      ├──────────────────┤
         │ id (PK)          │      │ id (PK)          │
         │ user_id (FK)     │      │ user_id (FK)     │
         │ provider         │      │ prompt           │
         │ provider_user_id │      │ model_name       │
         │ provider_email   │      │ model_cost       │
         │ created_at       │      │ image_urls       │
         └──────────────────┘      │ status           │
                                   │ is_public        │
                                   │ tags_used        │
                                   │ created_at       │
                                   └──────┬───────────┘
                                          │ 1:N
                                    ┌─────▼─────────┐
                                    │image_feedback │
                                    ├───────────────┤
                                    │ id (PK)       │
                                    │ generation_id │
                                    │ user_id       │
                                    │ feedback_type │
                                    │ tags_used     │
                                    │ created_at    │
                                    └───────────────┘
```

### 2. 配置与统计域

```
┌─────────────────────────────────────────────────────────────────────┐
│                        配置与统计管理域                              │
└─────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐        ┌──────────────┐      ┌─────────────────┐
    │    tags     │        │  ai_models   │      │scene_templates  │
    ├─────────────┤        ├──────────────┤      ├─────────────────┤
    │ id (PK)     │        │ id (PK)      │      │ id (PK)         │
    │ category    │        │ name         │      │ name            │
    │ label       │        │ provider     │      │ category        │
    │ value       │        │ cost_per_gen │      │ tags[]          │
    │ sort_order  │        │ is_enabled   │      │ usage_count     │
    │ is_enabled  │        │ created_at   │      │ rating          │
    │ created_at  │        └──────────────┘      │ created_at      │
    └──────┬──────┘                              └────────┬─────────┘
           │ 1:N                                          │ 1:N
           │                             ┌────────────────┴────────────┐
    ┌──────▼──────────┐    ┌─────────────▼──────┐  ┌──────────────────┐
    │   tag_stats     │    │user_template_fav.. │  │template_ratings  │
    ├─────────────────┤    ├────────────────────┤  ├──────────────────┤
    │ id (PK)         │    │ id (PK)            │  │ id (PK)          │
    │ tag_name        │    │ user_id (FK)       │  │ template_id (FK) │
    │ tag_category    │    │ template_id (FK)   │  │ user_id (FK)     │
    │ usage_count     │    │ notes              │  │ rating           │
    │ success_rate    │    │ created_at         │  │ review           │
    │ average_rating  │    └────────────────────┘  │ created_at       │
    │ last_used       │                            └──────────────────┘
    │ created_at      │
    └─────────────────┘

    ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐
    │  daily_stats     │   │ prompt_stats     │   │prompt_trans... │
    ├──────────────────┤   ├──────────────────┤   ├────────────────┤
    │ id (PK)          │   │ id (PK)          │   │ id (PK)        │
    │ date             │   │ prompt_text      │   │ original_pr... │
    │ total_gen...     │   │ usage_count      │   │ translated_.. │
    │ total_users      │   │ last_used        │   │ confidence     │
    │ total_cost       │   │ average_rating   │   │ created_at     │
    │ created_at       │   └──────────────────┘   └────────────────┘
    └──────────────────┘
```

### 3. 推荐系统域

```
┌────────────────────────────────────────────────────────────────┐
│                    推荐与实验系统域                            │
└────────────────────────────────────────────────────────────────┘

         ┌────────────────┐
         │  user_events   │
         ├────────────────┤
         │ id (PK)        │
         │ user_id (FK)   │
         │ event_type     │
         │ target_type    │
         │ target_id      │
         │ metadata       │
         │ created_at     │
         └────────┬───────┘
                  │ N:M
        ┌─────────▼──────────┐
        │ user_preferences   │
        ├────────────────────┤
        │ id (PK)            │
        │ user_id (FK)       │
        │ preference_type    │
        │ preference_key     │
        │ score              │
        │ interaction_count  │
        │ last_interaction   │
        └────────────────────┘

         ┌─────────────────┐
         │ recommendations │
         ├─────────────────┤
         │ id (PK)         │
         │ user_id (FK)    │
         │ rec_type        │
         │ algorithm       │
         │ created_at      │
         └────────┬────────┘
                  │ 1:N
    ┌─────────────▼──────────────┐
    │recommendation_interactions │
    ├──────────────────────────┤
    │ id (PK)                  │
    │ recommendation_id (FK)   │
    │ user_id (FK)             │
    │ item_id                  │
    │ action                   │
    │ position                 │
    │ created_at               │
    └──────────────────────────┘

         ┌──────────────────┐
         │  experiments     │
         ├──────────────────┤
         │ id (PK)          │
         │ name             │
         │ variants[]       │
         │ target_metric    │
         │ status           │
         │ created_at       │
         └────────┬─────────┘
                  │ 1:N
    ┌─────────────▼──────────────────┐
    │user_experiment_assignments     │
    ├───────────────────────────────┤
    │ id (PK)                       │
    │ user_id (FK)                  │
    │ experiment_id (FK)            │
    │ variant_id                    │
    │ assigned_at                   │
    └───────────────────────────────┘

         ┌──────────────────┐
         │  popular_items   │
         ├──────────────────┤
         │ id (PK)          │
         │ item_type        │
         │ item_id          │
         │ score            │
         │ time_period      │
         │ calculated_at    │
         └──────────────────┘
```

### 4. 关键外键关系总结

| 源表 | 源列 | 目标表 | 目标列 | 关系类型 | 级联删除 |
|------|------|--------|--------|---------|---------|
| auth_accounts | user_id | users | id | N:1 | ✓ (假定) |
| generations | user_id | users | id | N:1 | ✓ (假定) |
| image_feedback | generation_id | generations | id | N:1 | ✓ (假定) |
| image_feedback | user_id | users | id | N:1 | ✓ (假定) |
| user_template_favorites | user_id | users | id | N:1 | ✓ (假定) |
| user_template_favorites | template_id | scene_templates | id | N:1 | ✓ (假定) |
| template_ratings | template_id | scene_templates | id | N:1 | ✓ (假定) |
| template_ratings | user_id | users | id | N:1 | ✓ (假定) |
| template_usage_history | template_id | scene_templates | id | N:1 | ✓ (假定) |
| template_usage_history | user_id | users | id | N:1 | ✓ (假定) |
| user_events | user_id | users | id | N:1 | ✓ (假定) |
| user_preferences | user_id | users | id | N:1 | ✓ (假定) |
| recommendations | user_id | users | id | N:1 | ✓ (假定) |
| recommendation_interactions | user_id | users | id | N:1 | ✓ (假定) |
| user_experiment_assignments | user_id | users | id | N:1 | ✓ (假定) |
| user_experiment_assignments | experiment_id | experiments | id | N:1 | ✓ (假定) |

---

## Repository层分析

### 层级设计

```
┌────────────────────────────────────────────────┐
│            Repository Layer (数据访问层)       │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │        BaseRepository (基础类)            │ │
│  │  ├─ getClient(): SupabaseClient          │ │
│  │  └─ protected supabase member            │ │
│  └──────────────┬───────────────────────────┘ │
│                 │ extends                     │
│     ┌───────────┼───────────┬─────────────┐   │
│     │           │           │             │   │
│  ┌──▼──────┐ ┌─▼────────┐ ┌▼──────────┐ │   │
│  │UserRepo │ │GenRepo   │ │TagRepo    │ │   │
│  ├─────────┤ ├──────────┤ ├───────────┤ │   │
│  │-Finder  │ │-Finder   │ │-upsertMany│ │   │
│  │-Creator │ │-Creator  │ │-findPopular
│  │-Updater │ │-Paginator│ │-updateRate│ │   │
│  └─────────┘ └──────────┘ └───────────┘ │   │
│                                          │   │
│  ┌─────────────┐ ┌────────────────────┐ │   │
│  │FeedbackRepo │ │StatsRepository     │ │   │
│  ├─────────────┤ ├────────────────────┤ │   │
│  │-findBy..    │ │-dailyStats related │ │   │
│  │-create      │ │-promptStats related│ │   │
│  │-update      │ │                    │ │   │
│  │-delete      │ │                    │ │   │
│  └─────────────┘ └────────────────────┘ │   │
│                                          │   │
│  ┌──────────────────┐ ┌────────────────┐ │   │
│  │ConfigRepository  │ │TranslationRepo │ │   │
│  ├──────────────────┤ ├────────────────┤ │   │
│  │-Tags CRUD        │ │-findByHash     │ │   │
│  │-Templates CRUD   │ │-upsert         │ │   │
│  │-Models CRUD      │ │-deleteOlder    │ │   │
│  └──────────────────┘ └────────────────┘ │   │
│                                          │   │
│  ┌────────────────────────────────────┐  │   │
│  │SceneTemplateRepository             │  │   │
│  ├────────────────────────────────────┤  │   │
│  │-findAll/findByFilter               │  │   │
│  │-favorite related                   │  │   │
│  │-rating related                     │  │   │
│  │-usage history related              │  │   │
│  └────────────────────────────────────┘  │   │
│                                          │   │
└──────────────────────────────────────────┘   │
```

### Repository类别分析

#### 1. 通用模式

所有Repository都遵循Singleton模式：

```typescript
private static instance: XxxRepository;

private constructor() {
  super();
}

static getInstance(): XxxRepository {
  if (!XxxRepository.instance) {
    XxxRepository.instance = new XxxRepository();
  }
  return XxxRepository.instance;
}
```

#### 2. 关键Repository的职责

**UserRepository - 6大功能块**
```
查询方法:
  ├─ findByAuthProvider(provider, id)      // 主查询方法
  ├─ findByFingerprint(fingerprint)        // 设备指纹查询
  ├─ findById(userId)                      // ID查询
  ├─ findByEmail(email)                    // 邮箱查询
  └─ findAuthAccounts(userId)              // 获取所有认证账号

创建方法:
  ├─ create(provider, providerUserId, options)  // 创建用户+认证
  └─ linkAuthAccount(userId, provider, id)      // 绑定新认证方式

更新方法:
  ├─ update(userId, updates)               // 通用更新
  ├─ resetDailyQuota(userId)              // 重置每日配额
  └─ incrementUsage(userId, ...)          // 增加使用计数

合并方法:
  ├─ mergeUsers(sourceId, targetId)       // 合并用户数据
  └─ mergeOAuthUsers(sourceId, targetId)  // 合并OAuth账号
```

**GenerationRepository - 3大功能块**
```
保存方法:
  └─ save(params): Generation

查询方法:
  ├─ findByUserId(userId, limit)          // 用户历史
  ├─ findByUserIdWithPagination(...)      // 分页历史
  ├─ findPublic(limit)                    // 公开作品
  ├─ findPublicWithPagination(...)        // 分页公开作品
  └─ findTodayGenerations()               // 今日生成记录

匿名处理:
  └─ 公开记录使用 'anonymous' user_id
```

**SceneTemplateRepository - 4大功能块**
```
查询方法:
  ├─ findAll(sortBy)
  ├─ findByFilter(filter, sortBy, limit)
  ├─ findById(templateId)
  └─ getCategories()

收藏相关:
  ├─ addFavorite(userId, templateId)
  ├─ removeFavorite(userId, templateId)
  ├─ isFavorited(userId, templateId)
  ├─ getFavoriteStatusMap(userId, ids)
  └─ getFavorites(userId)

评分相关:
  ├─ upsertRating(userId, templateId, rating, review)
  ├─ getUserRating(userId, templateId)
  └─ getTemplateRatings(templateId, limit)

使用历史:
  ├─ incrementUsageCount(templateId)
  ├─ recordUsage(userId, templateId, options)
  └─ getUserUsageHistory(userId, limit)
```

#### 3. 查询优化特性

**批量操作**
```typescript
// TagRepository
upsertMany(tags): 一次请求更新多个标签

// FeedbackRepository
findByGenerationIds(ids): Map<generationId, feedback[]>  // 批量查询反馈

// SceneTemplateRepository
getFavoriteStatusMap(userId, templateIds): Map<id, isLiked>  // 批量检查状态
```

**分页支持**
```typescript
interface PaginationResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

// 实现分页的Repository：
- GenerationRepository.findByUserIdWithPagination()
- GenerationRepository.findPublicWithPagination()
```

**异常处理模式**
```typescript
// 成功路径
const { data, error } = await query;
if (error) {
  if (error.code === 'PGRST116') {  // 未找到
    return null;  // 或空数组
  }
  throw new Error(`具体错误信息: ${error.message}`);
}
return data;
```

---

## Service层分析

### 服务架构

```
┌────────────────────────────────────────────────┐
│        Service Layer (业务逻辑层)              │
├────────────────────────────────────────────────┤
│                                                │
│  依赖关系：Service → Repository → Database    │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │         UserService                      │ │
│  │  ├─ getOrCreateUser() → 带缓存          │ │
│  │  ├─ getOrCreateUserByOAuth()             │ │
│  │  ├─ linkAuthProvider()                   │ │
│  │  ├─ getAuthAccounts()                    │ │
│  │  ├─ getUserUsageStats()                  │ │
│  │  ├─ canUserGenerate()                    │ │
│  │  ├─ recordUsage()                        │ │
│  │  └─ getUserFeedbackStats()               │ │
│  │                                          │ │
│  │  缓存策略: 5分钟过期                      │ │
│  │  缓存字段: cachedUser, userCacheExpiry   │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │      GenerationService                   │ │
│  │  ├─ saveGeneration()                     │ │
│  │  ├─ getUserGenerations()                 │ │
│  │  ├─ getUserGenerationsWithPagination()   │ │
│  │  ├─ getPublicGenerations()               │ │
│  │  ├─ getPublicGenerationsWithPagination() │ │
│  │  ├─ updatePromptStats()                  │ │
│  │  ├─ getPopularPrompts()                  │ │
│  │  ├─ updateDailyStats()                   │ │
│  │  ├─ getDailyStats()                      │ │
│  │  └─ cleanupDuplicateDailyStats()         │ │
│  │                                          │ │
│  │  异步操作:                               │ │
│  │  ├─ updateDailyStats() 非阻塞          │ │
│  │  └─ upsertMany() tags 非阻塞            │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │         TagService                       │ │
│  │  ├─ updateTagStats()                     │ │
│  │  ├─ getPopularTags()                     │ │
│  │  ├─ getTagRecommendations()              │ │
│  │  ├─ analyzeTagTrends()                   │ │
│  │  ├─ updateSpecificTagsSuccessRates()     │ │
│  │  └─ updateTagSuccessRates()              │ │
│  │                                          │ │
│  │  推荐算法:                               │ │
│  │  score = usage_count                    │ │
│  │         * (1.2 if success_rate > 0.7)  │ │
│  │         * (1.1 if rating > 4)           │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │       FeedbackService                    │ │
│  │  ├─ submitImageFeedback()                │ │
│  │  │  └─ 支持创建/更新/删除反馈          │ │
│  │  ├─ getImageFeedback()                   │ │
│  │  └─ getBatchImageFeedback()              │ │
│  │                                          │ │
│  │  事务操作:                               │ │
│  │  提交反馈时触发标签成功率更新             │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │    SceneTemplateService                  │ │
│  │  ├─ getAllTemplates() → 带缓存 (5分钟)  │ │
│  │  ├─ browseTemplates()                    │ │
│  │  ├─ searchTemplates()                    │ │
│  │  ├─ getTemplateById()                    │ │
│  │  ├─ getCategories()                      │ │
│  │  ├─ getFavoritesMap()                    │ │
│  │  ├─ rateTemplate()                       │ │
│  │  ├─ getFavorites()                       │ │
│  │  ├─ getRecommendations()                 │ │
│  │  └─ trackTemplateUsage()                 │ │
│  │                                          │ │
│  │  缓存策略: popular排序结果缓存 5分钟     │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │     TranslationService                   │ │
│  │  ├─ getTranslationFromCache()            │ │
│  │  ├─ saveTranslationToCache()             │ │
│  │  ├─ translatePrompt()                    │ │
│  │  └─ cleanupOldTranslations()             │ │
│  │                                          │ │
│  │  缓存键: SHA-256(original_prompt)        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │      ConfigService                       │ │
│  │  ├─ Tags管理 (CRUD)                      │ │
│  │  ├─ SceneTemplates管理 (CRUD)            │ │
│  │  ├─ AIModels管理 (CRUD)                  │ │
│  │  └─ 批量操作支持                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

### 服务间的依赖关系

```
                    ┌─────────────────┐
                    │ AuthService     │
                    │ (外部)          │
                    └────────┬────────┘
                             │ getAppUser()
                    ┌────────▼────────┐
                    │  UserService    │
                    └────┬────────┬───┘
                         │        │
         ┌───────────────┼─────────┼──────────┐
         │               │        │           │
    ┌────▼──────┐  ┌─────▼──┐  ┌▼────────┐ ┌▼────────────┐
    │Generation  │  │ Feedback  │  │ Tag     │  │SceneTemplate │
    │Service     │  │Service    │  │Service  │  │Service       │
    │    │       │  │    │      │  │    │    │  │     │        │
    │    │       │  │    │      │  │    └──────│──┘     │        │
    │    └─────────────┘      │  │           │        │
    │              │           │  │           │        │
    │              └───────────┼──┘           │        │
    │                          │              │        │
    └──────────────────────────┼──────────────┘        │
                               │                       │
                    ┌──────────▼──────────┐            │
                    │  (Repositories)     │            │
                    │                     │            │
                    │ - UserRepository    │            │
                    │ - GenerationRepo    │            │
                    │ - TagRepository     │            │
                    │ - FeedbackRepository│            │
                    │ - StatsRepository   │            │
                    │ - TranslationRepo   │            │
                    │ - ConfigRepository  │            │
                    │ - SceneTemplateRepo │            │
                    └──────────┬──────────┘            │
                               │                       │
                               └───────────────────────┘
                                     ▼
                            ┌──────────────────┐
                            │ Supabase Client  │
                            │   Database       │
                            └──────────────────┘
```

### 关键业务流程

#### 1. 图片生成与反馈流程

```
生成流程:
  用户提交 → GenerationService.saveGeneration()
           ├─ 获取当前用户 (AuthService)
           ├─ GenerationRepository.save()
           ├─ (异步) updateDailyStats() → StatsRepository
           └─ (异步) updateTagStats() → TagRepository
                      (使用批量upsert)

反馈流程:
  提交反馈 → FeedbackService.submitImageFeedback()
           ├─ 检查是否已有反馈
           │  ├─ 有 → 更新反馈
           │  └─ 无 → 创建反馈
           └─ (异步) updateSpecificTagsSuccessRates()
                    ├─ 获取相关反馈
                    ├─ 计算成功率
                    └─ 批量更新标签成功率
```

#### 2. 用户登录与合并流程

```
设备指纹登录:
  首次访问 → UserService.getOrCreateUser()
           ├─ 生成设备指纹
           ├─ 查找现有用户 (UserRepository)
           ├─ 不存在 → 创建用户+认证记录
           └─ 存在 → 检查是否需要重置配额

OAuth登录:
  用户授权 → UserService.getOrCreateUserByOAuth()
           ├─ 查找现有用户 (OAuth provider+id)
           ├─ 存在 → 更新用户信息
           └─ 不存在 → 创建用户

账号绑定:
  匿名用户→OAuth → 合并两个用户账号
                  ├─ UserRepository.mergeOAuthUsers()
                  ├─ 迁移认证方式
                  ├─ 迁移生成记录
                  ├─ 迁移反馈记录
                  └─ 删除源用户
```

#### 3. 场景模板推荐流程

```
获取推荐:
  用户点击 → SceneTemplateService.getRecommendations()
           ├─ 获取用户偏好 (UserPreference表)
           ├─ 搜索相关模板
           ├─ 评分和排序
           │  score = usage_count
           │         × rating_multiplier
           │         × user_preference_score
           └─ 返回Top N推荐

使用模板:
  用户使用 → SceneTemplateService.trackTemplateUsage()
           ├─ SceneTemplateRepository.recordUsage()
           ├─ 记录到 template_usage_history
           ├─ 更新 usage_count
           └─ 触发推荐系统更新
```

---

## 数据流程图

### 1. 完整业务流程

```
┌─────────────────────────────────────────────────────────────────┐
│                   图片生成完整流程                              │
└─────────────────────────────────────────────────────────────────┘

用户界面
  │
  ├─ 选择标签 → TagService.getPopularTags()
  │              ↓
  │         TagRepository.findPopular()
  │              ↓
  │         Supabase: tag_stats 表
  │
  ├─ 输入提示词 → TranslationService.translatePrompt()
  │               ↓
  │         TranslationRepository.findByHash()
  │         (如果缓存存在，直接返回；否则调用LLM)
  │              ↓
  │         TranslationRepository.upsert()
  │              ↓
  │         Supabase: prompt_translations 表
  │
  ├─ 选择模型 → ConfigService.getAIModels()
  │             ↓
  │         ConfigRepository.getAIModels()
  │              ↓
  │         Supabase: ai_models 表
  │
  └─ 点击生成 → GenerationService.saveGeneration()
                ├─ AuthService.getAppUser() ← 获取用户ID
                │
                ├─ GenerationRepository.save()
                │  ├─ 保存生成记录
                │  └─ Supabase: generations 表
                │
                ├─ (异步) updateDailyStats()
                │  ├─ GenerationRepository.findTodayGenerations()
                │  ├─ 统计今日数据
                │  └─ StatsRepository.createDailyStats() 或 updateDailyStats()
                │       └─ Supabase: daily_stats 表
                │
                └─ (异步) TagRepository.upsertMany()
                   ├─ 批量更新标签使用计数
                   └─ Supabase: tag_stats 表

后续反馈流程:
用户提交反馈 → FeedbackService.submitImageFeedback()
             ├─ FeedbackRepository.create()
             │  └─ Supabase: image_feedback 表
             │
             └─ (异步) TagService.updateSpecificTagsSuccessRates()
                ├─ FeedbackRepository.findByTags()
                │  └─ Supabase: image_feedback 表 (overlaps查询)
                │
                └─ TagRepository.batchUpdateSuccessRates()
                   └─ Supabase: tag_stats 表
```

### 2. 用户认证与数据合并

```
┌────────────────────────────────────────────────────────────┐
│              用户认证与合并流程                            │
└────────────────────────────────────────────────────────────┘

场景A: 新用户首次访问
  DeviceFingerprint.generateFingerprint()
    ├─ 收集客户端信息（UA、屏幕分辨率等）
    └─ SHA-256 hash → fingerprint
  
  UserService.getOrCreateUser()
    ├─ UserRepository.findByFingerprint()
    │  └─ Supabase: auth_accounts (device provider)
    │
    ├─ 不存在 → UserRepository.create()
    │           ├─ 创建 users 记录
    │           │  └─ daily_quota = 10
    │           │
    │           └─ 创建 auth_accounts 记录
    │              └─ provider = 'device'
    │
    └─ Supabase: users, auth_accounts 表


场景B: 设备用户绑定OAuth
  OAuth 提供商回调
    └─ UserService.linkAuthProvider(provider, id)
       ├─ 获取当前用户（设备指纹）
       └─ UserRepository.linkAuthAccount()
          ├─ 检查该OAuth账号是否已绑定
          └─ 创建新的 auth_accounts 记录
             ├─ provider = 'google'|'github'
             └─ 同一 user_id


场景C: 两个独立账号合并
  用户尝试用Google登录，系统检测到不同user_id
    └─ UserService 检测账号冲突
       └─ UserRepository.mergeOAuthUsers()
          ├─ 迁移 auth_accounts (除device外)
          │  └─ UPDATE auth_accounts SET user_id = target_id
          │
          ├─ 迁移 generations 记录
          │  └─ UPDATE generations SET user_id = target_id
          │
          ├─ 迁移 image_feedback 记录
          │  └─ UPDATE image_feedback SET user_id = target_id
          │
          ├─ 合并统计数据
          │  └─ total_generated += source.total_generated
          │
          └─ 删除源用户
             └─ DELETE FROM users WHERE id = source_id
                ├─ 级联删除 auth_accounts
                └─ 级联删除相关反馈
```

### 3. 数据查询流程

```
┌───────────────────────────────────────────────────────────────┐
│              数据查询流程（以推荐系统为例）                  │
└───────────────────────────────────────────────────────────────┘

获取热门标签:
  UI → TagService.getPopularTags()
       ├─ 参数: category, limit
       ├─ Service验证逻辑
       └─ TagRepository.findPopular()
           ├─ SELECT * FROM tag_stats
           │  WHERE tag_category = ?
           │  ORDER BY usage_count DESC
           │  LIMIT ?
           └─ 返回 TagStats[] 对象

获取标签推荐:
  UI → TagService.getTagRecommendations()
       ├─ 输入: usedTags[], category, limit
       ├─ Service排除已使用标签
       ├─ 计算推荐分数
       │  score = usage_count
       │         * (1.2 if success_rate > 0.7)
       │         * (1.1 if average_rating > 4.0)
       │
       └─ TagRepository.findRecommendations()
           ├─ SELECT * FROM tag_stats
           │  WHERE tag_category = ?
           │    AND usage_count > 0
           │  ORDER BY usage_count DESC
           │  LIMIT limit*2
           │
           └─ Client端过滤已使用标签
               └─ 返回Top N推荐

获取场景模板（带缓存）:
  UI → SceneTemplateService.getAllTemplates()
       │
       ├─ 检查缓存
       │  ├─ 缓存命中且未过期 → 直接返回
       │  └─ 缓存失效 → 继续
       │
       └─ SceneTemplateRepository.findAll()
           ├─ SELECT * FROM scene_templates
           │  WHERE status = 'active'
           │    AND is_public = true
           │  ORDER BY usage_count DESC
           │
           └─ Service缓存 (TTL: 5分钟)
               └─ 返回 SceneTemplate[]

搜索场景模板:
  UI → SceneTemplateService.searchTemplates()
       ├─ 输入: query string, limit
       └─ SceneTemplateRepository.findByFilter()
           ├─ SELECT * FROM scene_templates
           │  WHERE status = 'active'
           │    AND is_public = true
           │    AND (
           │      name ILIKE '%query%'
           │      OR description ILIKE '%query%'
           │    )
           │  ORDER BY rating DESC
           │  LIMIT limit
           └─ 返回搜索结果

批量获取用户收藏:
  UI → SceneTemplateService.getFavoritesMap()
       ├─ 输入: userId, templateIds[]
       └─ SceneTemplateRepository.getFavoriteStatusMap()
           ├─ SELECT template_id FROM user_template_favorites
           │  WHERE user_id = ?
           │    AND template_id = ANY(?)
           │
           └─ 返回 Map<templateId, isFavorited>
               (优化: 单次查询，支持N个模板)
```

---

## 关键SQL查询示例

### 1. 用户相关查询

```sql
-- 获取用户及其所有认证账号
SELECT u.*, aa.provider
FROM users u
LEFT JOIN auth_accounts aa ON u.id = aa.user_id
WHERE u.id = $1;

-- 获取用户今日生成数量
SELECT COUNT(*) as today_generation_count
FROM generations
WHERE user_id = $1
  AND DATE(created_at) = CURRENT_DATE;

-- 获取用户获得的反馈统计
SELECT 
  feedback_type,
  COUNT(*) as count
FROM image_feedback
WHERE user_id = $1
GROUP BY feedback_type;

-- 获取用户反馈率（今日）
SELECT 
  u.id,
  u.used_today,
  COUNT(DISTINCT f.id) as feedbacks_given,
  ROUND(COUNT(DISTINCT f.id)::numeric / u.used_today, 2) as feedback_rate
FROM users u
LEFT JOIN image_feedback f ON u.id = f.user_id 
  AND DATE(f.created_at) = CURRENT_DATE
WHERE u.id = $1
GROUP BY u.id, u.used_today;
```

### 2. 生成记录与统计查询

```sql
-- 获取用户生成历史（分页）
SELECT 
  id, user_id, prompt, model_name, model_cost,
  image_urls, status, created_at, is_public,
  original_image_urls, r2_keys, tags_used,
  view_count, like_count, share_count, is_featured
FROM generations
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- 获取今日统计
SELECT 
  COUNT(*) as total_generations,
  COUNT(DISTINCT user_id) as active_users,
  SUM(model_cost) as total_cost
FROM generations
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'completed';

-- 获取公开作品热度排序
SELECT 
  id, prompt, model_name, image_urls,
  created_at, is_public,
  (view_count + like_count * 2 + share_count * 3) as engagement_score
FROM generations
WHERE is_public = true AND status = 'completed'
ORDER BY 
  is_featured DESC,
  engagement_score DESC,
  created_at DESC
LIMIT $1;

-- 获取热门提示词
SELECT 
  prompt_text,
  usage_count,
  average_rating,
  last_used
FROM prompt_stats
ORDER BY usage_count DESC
LIMIT $1;
```

### 3. 标签相关查询

```sql
-- 获取热门标签及其成功率
SELECT 
  tag_name,
  tag_category,
  usage_count,
  success_rate,
  average_rating,
  last_used
FROM tag_stats
WHERE tag_category = $1
ORDER BY 
  usage_count DESC,
  average_rating DESC
LIMIT $2;

-- 计算标签的成功率
SELECT 
  tf.tag_name,
  COUNT(DISTINCT f.id) as total_uses,
  SUM(CASE WHEN f.feedback_type = 'like' THEN 1 ELSE 0 END) as likes,
  ROUND(
    SUM(CASE WHEN f.feedback_type = 'like' THEN 1 ELSE 0 END)::numeric 
    / COUNT(DISTINCT f.id), 
    2
  ) as success_rate
FROM (
  SELECT DISTINCT ON (g.id) 
    unnest(g.tags_used) -> 'name' as tag_name,
    g.id as generation_id
  FROM generations g
  WHERE g.tags_used IS NOT NULL
) tf
JOIN image_feedback f ON f.generation_id = tf.generation_id
GROUP BY tf.tag_name
HAVING COUNT(DISTINCT f.id) >= 5  -- 最少5次反馈
ORDER BY success_rate DESC;

-- 标签使用趋势（近7天）
SELECT 
  DATE(g.created_at) as date,
  ts.tag_category,
  COUNT(*) as daily_usage
FROM generations g
CROSS JOIN LATERAL jsonb_to_recordset(g.tags_used) as tags(name text)
JOIN tag_stats ts ON ts.tag_name = tags.name
WHERE g.created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(g.created_at), ts.tag_category
ORDER BY date DESC, daily_usage DESC;
```

### 4. 场景模板相关查询

```sql
-- 获取热门场景模板
SELECT 
  id, name, category, difficulty,
  usage_count, rating, likes_count,
  created_at
FROM scene_templates
WHERE status = 'active' AND is_public = true
ORDER BY 
  usage_count DESC,
  rating DESC
LIMIT $1;

-- 搜索场景模板
SELECT 
  id, name, category, subcategory,
  difficulty, usage_count, rating
FROM scene_templates
WHERE status = 'active'
  AND is_public = true
  AND (
    name ILIKE '%' || $1 || '%'
    OR description ILIKE '%' || $1 || '%'
  )
ORDER BY rating DESC, usage_count DESC
LIMIT $2;

-- 获取用户的模板评分
SELECT 
  tr.id, tr.template_id, tr.rating, tr.review,
  tr.helpful_count, tr.created_at,
  st.name as template_name
FROM template_ratings tr
JOIN scene_templates st ON tr.template_id = st.id
WHERE tr.user_id = $1
ORDER BY tr.created_at DESC;

-- 获取用户用过的模板（含成功率）
SELECT 
  st.id, st.name, st.category,
  COUNT(tuh.id) as usage_count,
  SUM(CASE WHEN tuh.was_successful THEN 1 ELSE 0 END) as successful_count,
  ROUND(
    SUM(CASE WHEN tuh.was_successful THEN 1 ELSE 0 END)::numeric 
    / COUNT(tuh.id),
    2
  ) as success_rate
FROM template_usage_history tuh
JOIN scene_templates st ON tuh.template_id = st.id
WHERE tuh.user_id = $1
GROUP BY st.id, st.name, st.category
ORDER BY usage_count DESC;
```

### 5. 推荐系统查询

```sql
-- 用户偏好分析
SELECT 
  preference_type,
  preference_key,
  score,
  interaction_count,
  last_interaction
FROM user_preferences
WHERE user_id = $1
ORDER BY score DESC
LIMIT 20;

-- 相似用户查询（协同过滤基础）
SELECT 
  up2.user_id,
  COUNT(*) as common_preferences,
  SUM(ABS(up1.score - up2.score)) as score_diff
FROM user_preferences up1
JOIN user_preferences up2 
  ON up1.preference_key = up2.preference_key
  AND up1.user_id != up2.user_id
WHERE up1.user_id = $1
GROUP BY up2.user_id
HAVING COUNT(*) >= 3  -- 至少有3个共同偏好
ORDER BY score_diff ASC
LIMIT 10;

-- 获取热门组合标签
SELECT 
  array_agg(DISTINCT unnest(tags_used)) as tag_combo,
  COUNT(*) as usage_count,
  ROUND(
    SUM(CASE WHEN li.feedback_type = 'like' THEN 1 ELSE 0 END)::numeric
    / COUNT(*),
    2
  ) as success_rate
FROM generations g
LEFT JOIN image_feedback li ON g.id = li.generation_id
WHERE g.tags_used IS NOT NULL
  AND array_length(g.tags_used, 1) > 1
GROUP BY array_agg(DISTINCT unnest(tags_used))
HAVING COUNT(*) >= 10
ORDER BY success_rate DESC, usage_count DESC
LIMIT 20;

-- 推荐与互动跟踪
SELECT 
  r.id as recommendation_id,
  COUNT(ri.id) as interaction_count,
  SUM(CASE WHEN ri.action = 'click' THEN 1 ELSE 0 END) as clicks,
  SUM(CASE WHEN ri.action = 'adopt' THEN 1 ELSE 0 END) as adoptions,
  ROUND(
    SUM(CASE WHEN ri.action = 'adopt' THEN 1 ELSE 0 END)::numeric 
    / NULLIF(COUNT(ri.id), 0),
    2
  ) as adoption_rate
FROM recommendations r
LEFT JOIN recommendation_interactions ri ON r.id = ri.recommendation_id
WHERE r.created_at >= NOW() - INTERVAL '30 days'
GROUP BY r.id
ORDER BY adoption_rate DESC, interaction_count DESC;
```

### 6. 数据维护查询

```sql
-- 查找重复的每日统计记录
SELECT 
  date, COUNT(*) as duplicate_count
FROM daily_stats
GROUP BY date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 清理过期的翻译缓存（超过30天）
DELETE FROM prompt_translations
WHERE created_at < NOW() - INTERVAL '30 days';

-- 重建标签统计（全量重新计算）
WITH tag_feedback AS (
  SELECT 
    ts.tag_name,
    COUNT(DISTINCT f.id) as total_feedback,
    SUM(CASE WHEN f.feedback_type = 'like' THEN 1 ELSE 0 END) as positive_feedback
  FROM tag_stats ts
  LEFT JOIN image_feedback f ON f.tags_used @> ARRAY[ts.tag_name]
  WHERE f.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY ts.tag_name
)
UPDATE tag_stats ts
SET 
  success_rate = COALESCE(
    tf.positive_feedback::numeric / NULLIF(tf.total_feedback, 0),
    0
  ),
  average_rating = COALESCE(
    (tf.positive_feedback::numeric / NULLIF(tf.total_feedback, 0)) * 5,
    ts.average_rating
  ),
  updated_at = NOW()
FROM tag_feedback tf
WHERE ts.tag_name = tf.tag_name;

-- 获取未使用的标签（可能需要删除）
SELECT 
  id, tag_name, tag_category,
  usage_count, last_used
FROM tag_stats
WHERE usage_count = 0
  OR last_used < NOW() - INTERVAL '90 days'
ORDER BY last_used ASC;
```

---

## 数据一致性机制

### 1. 并发控制

#### 当前实现
- **乐观并发**：Supabase自动处理
- **缓存失效**：手动清除 (UserService.clearUserCache)
- **时间戳**：updated_at字段追踪

#### 潜在问题

```typescript
// 问题1：缓存不一致
// UserService 的5分钟缓存可能导致：
// 场景：用户登录Google账号，设备指纹用户和Google用户需要合并
// 如果5分钟内读到旧数据，可能出现不一致

// 问题2：并发写入
// 两个标签页同时调用：recordUsage()
// └─ incrementUsage(userId, used_today, total_generated)
//    可能出现：used_today未按预期递增

// 问题3：分布式事务
// saveGeneration时：
// ├─ GenerationRepository.save() ✓
// ├─ (异步) updateDailyStats()  可能失败
// └─ (异步) updateTagStats()    可能失败
// 如果这两个异步操作失败，数据将不一致
```

#### 改进建议

```typescript
// 1. 使用数据库触发器处理异步操作
-- CREATE TRIGGER on generations AFTER INSERT
-- EXECUTE FUNCTION update_daily_stats_on_generation();

// 2. 添加乐观锁版本号
interface User {
  version: number;  // 每次更新递增
}

// 更新时检查版本：
UPDATE users SET used_today = ..., version = version + 1
WHERE id = $1 AND version = $2;

// 3. 消息队列处理异步操作
// 使用 Supabase 的 pg_cron 或外部消息队列

// 4. 缓存同步
// 在关键操作后立即清除缓存
this.clearUserCache();
```

### 2. 数据完整性约束

#### 当前约束

```sql
-- 假设的表定义（基于代码推断）

CREATE TABLE users (
  id UUID PRIMARY KEY,
  daily_quota INTEGER NOT NULL DEFAULT 10,
  used_today INTEGER NOT NULL DEFAULT 0,
  total_generated INTEGER NOT NULL DEFAULT 0,
  -- 约束
  CONSTRAINT check_quotas CHECK (
    used_today >= 0 
    AND total_generated >= 0
    AND used_today <= daily_quota
  )
);

CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE generations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')),
  is_public BOOLEAN NOT NULL DEFAULT true,
  model_cost NUMERIC(10,4) CHECK (model_cost >= 0)
);

CREATE TABLE image_feedback (
  id UUID PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike', NULL))
);
```

#### 必要的额外约束

```sql
-- 1. 防止用户重复评分同一模板
CREATE UNIQUE INDEX ON template_ratings(user_id, template_id);

-- 2. 防止重复收藏
CREATE UNIQUE INDEX ON user_template_favorites(user_id, template_id);

-- 3. 防止重复反馈（同一批次）
CREATE UNIQUE INDEX ON image_feedback(generation_id, user_id);

-- 4. 防止重复实验分组
CREATE UNIQUE INDEX ON user_experiment_assignments(user_id, experiment_id);

-- 5. 标签每日统计去重
CREATE UNIQUE INDEX ON tag_stats(tag_name, tag_category);
```

### 3. 级联操作与回滚

#### 删除级联链

```
删除 users
  ├─ CASCADE: auth_accounts
  ├─ CASCADE: generations
  │  └─ CASCADE: image_feedback
  ├─ CASCADE: user_template_favorites
  ├─ CASCADE: template_ratings
  ├─ CASCADE: template_usage_history
  ├─ CASCADE: user_events
  ├─ CASCADE: user_preferences
  ├─ CASCADE: recommendations
  ├─ CASCADE: recommendation_interactions
  ├─ CASCADE: user_experiment_assignments
  └─ 影响范围：~20张表的数据
```

#### 事务处理

```typescript
// 当前实现：无事务

// 改进方案：使用 Supabase RPC 或触发器
async mergeUsers(sourceUserId, targetUserId) {
  try {
    await supabase.rpc('merge_users', {
      source_id: sourceUserId,
      target_id: targetUserId,
    });
  } catch (error) {
    // 自动回滚
    throw error;
  }
}

-- 数据库端实现
CREATE OR REPLACE FUNCTION merge_users(
  source_id UUID,
  target_id UUID
) RETURNS void AS $$
BEGIN
  -- 所有操作在一个事务中
  UPDATE generations SET user_id = target_id WHERE user_id = source_id;
  UPDATE image_feedback SET user_id = target_id WHERE user_id = source_id;
  -- ... 更多操作
  DELETE FROM users WHERE id = source_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source user not found';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 4. 数据备份与恢复

#### 当前状态
- **不明确**：代码中未见备份策略
- **建议**：启用 Supabase 的点位恢复（PITR）

#### 恢复策略

```
关键操作的恢复步骤：
1. 用户删除（级联删除）
   恢复方案：
   ├─ PITR 时间点恢复
   └─ 需要备份历史快照

2. 生成记录删除
   恢复方案：
   ├─ 查询删除前快照
   └─ 重新插入记录

3. 标签统计错误
   恢复方案：
   ├─ 从 generations + image_feedback 重建
   └─ 使用 updateTagSuccessRates() 重新计算
```

---

## 性能分析与优化建议

### 1. 查询性能分析

#### 高频查询

| 查询类型 | 频率 | 当前优化 | 建议 |
|---------|------|---------|------|
| 用户登录查询 | 每次访问 | ✓ 缓存5分钟 | 良好 |
| 获取生成历史 | 多次 | ✓ 分页 | 需要索引 |
| 获取热门标签 | 频繁 | ✓ 排序 | 需要索引 |
| 搜索模板 | 频繁 | ILIKE模糊 | 需要全文索引 |
| 统计查询 | 低频 | 无 | 物化视图 |

#### 必要的索引

```sql
-- 1. 用户认证查询加速
CREATE INDEX idx_auth_accounts_provider_id 
ON auth_accounts(provider, provider_user_id);

-- 2. 生成记录查询加速
CREATE INDEX idx_generations_user_date 
ON generations(user_id, created_at DESC);

CREATE INDEX idx_generations_public_status 
ON generations(is_public, status, created_at DESC);

-- 3. 反馈查询加速
CREATE INDEX idx_image_feedback_generation 
ON image_feedback(generation_id);

CREATE INDEX idx_image_feedback_user_date 
ON image_feedback(user_id, created_at DESC);

-- 4. 标签查询加速
CREATE INDEX idx_tag_stats_category_usage 
ON tag_stats(tag_category, usage_count DESC);

CREATE INDEX idx_tag_stats_last_used 
ON tag_stats(last_used DESC);

-- 5. 场景模板查询加速
CREATE INDEX idx_scene_templates_status_public 
ON scene_templates(status, is_public);

CREATE INDEX idx_scene_templates_usage_rating 
ON scene_templates(usage_count DESC, rating DESC);

-- 6. 搜索优化（全文搜索）
CREATE INDEX idx_scene_templates_name_desc 
ON scene_templates USING gin(to_tsvector('chinese', name));

CREATE INDEX idx_scene_templates_desc_fts 
ON scene_templates USING gin(to_tsvector('chinese', description));

-- 7. 时间序列查询加速
CREATE INDEX idx_daily_stats_date 
ON daily_stats(date DESC);

-- 8. 用户事件分析
CREATE INDEX idx_user_events_user_type_date 
ON user_events(user_id, event_type, created_at DESC);

-- 9. 推荐系统
CREATE INDEX idx_recommendations_user_date 
ON recommendations(user_id, created_at DESC);

CREATE INDEX idx_rec_interactions_recommendation 
ON recommendation_interactions(recommendation_id);
```

#### 查询优化案例

```typescript
// 优化前：N+1 问题
async getUserGenerationsWithDetails(userId: string) {
  const generations = await generationRepo.findByUserId(userId);
  
  // 每条生成记录都要查询反馈 ❌ N个查询
  return Promise.all(
    generations.map(async (gen) => ({
      ...gen,
      feedback: await feedbackRepo.findByGenerationId(gen.id)
    }))
  );
}

// 优化后：批量查询
async getUserGenerationsWithDetails(userId: string) {
  const generations = await generationRepo.findByUserId(userId);
  
  // 一次查询获取所有反馈 ✓ 1个查询
  const feedbackMap = await feedbackRepo.findByGenerationIds(
    generations.map(g => g.id)
  );
  
  return generations.map(gen => ({
    ...gen,
    feedback: feedbackMap.get(gen.id) || []
  }));
}

// 优化前：模糊搜索性能差
SELECT * FROM scene_templates
WHERE name ILIKE '%' || $1 || '%'
  OR description ILIKE '%' || $1 || '%'
LIMIT 50;

// 优化后：全文搜索
SELECT * FROM scene_templates
WHERE to_tsvector('chinese', name || ' ' || COALESCE(description, ''))
  @@ plainto_tsquery('chinese', $1)
LIMIT 50;
```

### 2. 缓存策略

#### 当前缓存

```typescript
// 1. UserService 缓存
private cachedUser: User | null = null;
private userCacheExpiry: number = 0;
private readonly USER_CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 2. SceneTemplateService 缓存
private templatesCache: SceneTemplate[] | null = null;
private templatesCacheExpiry: number = 0;
private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟
```

#### 缓存改进方案

```typescript
// 使用多层缓存
class CacheManager {
  private l1Cache = new Map(); // 内存缓存（5分钟）
  private l2Cache: Redis;       // Redis缓存（1小时）
  
  async get(key: string) {
    // 先查L1
    if (this.l1Cache.has(key) && !this.isExpired(key)) {
      return this.l1Cache.get(key);
    }
    
    // 再查L2
    const l2Data = await this.l2Cache.get(key);
    if (l2Data) {
      this.l1Cache.set(key, l2Data);
      return l2Data;
    }
    
    return null;
  }
  
  // 缓存预热
  async warmup() {
    // 定期刷新热数据
    const hotData = await this.fetchHotData();
    for (const [key, value] of hotData) {
      await this.l2Cache.setex(key, 3600, JSON.stringify(value));
    }
  }
}
```

### 3. 数据库连接优化

#### 当前实现
- 单个全局 Supabase 客户端
- 连接管理由 Supabase 负责
- 无连接池配置

#### 优化建议

```typescript
// 1. 连接复用
// 当前实现已在 supabase.ts 中使用全局单例 ✓

// 2. 批量操作优化
// 使用 BATCH INSERT 而不是逐条插入
async saveGenerations(generations: Generation[]) {
  // ❌ 不好：N次插入
  for (const gen of generations) {
    await repo.save(gen);
  }
  
  // ✓ 好：1次批量插入
  const { error } = await supabase
    .from('generations')
    .insert(generations)
    .select();
}

// 3. 查询字段限制
// ✓ 当前实现已优化：只查询需要的字段
const { data } = await supabase
  .from('generations')
  .select(`
    id, user_id, prompt, model_name, model_cost,
    image_urls, status, created_at, is_public
  `)
  .eq('user_id', userId);
```

### 4. 数据库大小预估

```
假设数据规模：
- 活跃用户：10,000 人
- 日生成量：100,000 条记录
- 运营时间：1 年

表大小预估：

users: 10K × 200 bytes = 2 MB
auth_accounts: 15K × 300 bytes = 4.5 MB
generations: 36.5M × 1.5 KB = 55 GB ⚠️ 大表
image_feedback: 100M × 500 bytes = 50 GB ⚠️ 大表
tag_stats: 500 × 300 bytes = 150 KB
daily_stats: 365 × 1 KB = 365 KB
prompt_stats: 50K × 500 bytes = 25 MB
scene_templates: 500 × 5 KB = 2.5 MB
template_ratings: 100K × 300 bytes = 30 MB
template_usage_history: 10M × 200 bytes = 2 GB
user_events: 100M × 300 bytes = 30 GB ⚠️ 大表
user_preferences: 50K × 300 bytes = 15 MB
recommendations: 10M × 500 bytes = 5 GB
recommendation_interactions: 20M × 200 bytes = 4 GB
popular_items: 10K × 300 bytes = 3 MB
user_experiment_assignments: 50K × 200 bytes = 10 MB
experiments: 50 × 500 bytes = 25 KB

总计：约 140+ GB

优化策略：
1. 归档历史数据（>1年）
2. 分表策略：按月分表 generations, image_feedback 等
3. 分区表：按 user_id 或 created_at 分区
4. 定期清理过期数据
```

---

## 扩展性建议

### 1. 水平扩展

#### 当前架构瓶颈

```
单一 Supabase 实例
  ├─ 读写限制：每秒请求数受限
  ├─ 存储限制：单个数据库容量
  └─ 连接限制：并发连接数有限
```

#### 扩展方案

```
方案1：读写分离 + 复制
  ┌──────────────────────────┐
  │   主库（写）              │
  │   Supabase Production    │
  └──────────┬───────────────┘
             │ 物理复制
    ┌────────┴────────┐
    │                 │
  ┌─▼──┐          ┌──▼─┐
  │从库1│ 只读      │从库2│ 只读
  │(API)│          │(分析)
  └─────┘          └─────┘

方案2：分库分表
  ┌─────────────────┐
  │ 用户库 (users, auth_accounts)
  └────────┬────────┘
  ┌─────────▼──────────────────┐
  │生成库 (generations, feedback)
  │  按时间分表：2024_01, 2024_02...
  └─────────┬──────────────────┘
  ┌─────────▼──────────────────┐
  │统计库 (tag_stats, daily_stats)
  │  按时间分表和分区
  └──────────────────────────────┘

方案3：缓存层扩展
  应用端：
  ├─ 本地缓存（5分钟）
  └─ Redis缓存（1小时）
       ├─ 热数据：用户信息、标签
       ├─ 视图缓存：热门内容
       └─ 会话缓存：用户偏好
```

### 2. 新功能扩展

#### 实时功能

```typescript
// 当前：轮询或定期刷新
// 改进：使用 Supabase 实时功能

const { data: subscription } = await supabase
  .from('generations')
  .on('*', payload => {
    // 实时推送新生成
    console.log('New generation:', payload);
  })
  .subscribe();
```

#### 推荐系统增强

```typescript
// 当前：基于标签的简单推荐
// 改进：
// 1. 协同过滤
// 2. 内容基础推荐
// 3. 混合推荐

class RecommendationEngine {
  // 协同过滤：相似用户
  async getCollaborativeRecommendations(userId) {
    // 找相似用户
    // 返回他们喜欢的模板
  }
  
  // 内容推荐：相似模板
  async getContentBasedRecommendations(userId) {
    // 找用户交互过的模板
    // 推荐相似的模板
  }
  
  // 混合：加权综合
  async getHybridRecommendations(userId) {
    const collab = await this.getCollaborativeRecommendations(userId);
    const content = await this.getContentBasedRecommendations(userId);
    return this.weightedMerge(collab, content);
  }
}
```

#### 多语言支持

```typescript
// 当前：中文+英文标签
// 改进：多语言翻译表

interface TranslationRecord {
  id: string;
  table_name: 'tags' | 'scene_templates' | ...
  record_id: string;
  language: 'zh' | 'en' | 'ja' | 'ko' | ...
  field_name: 'label' | 'name' | 'description'
  translated_value: string;
  created_at: string;
}

// 动态加载翻译
const getTranslated = async (type, recordId, field, lang) => {
  const translation = await translationRepo.find({
    table_name: type,
    record_id: recordId,
    field_name: field,
    language: lang
  });
  return translation?.translated_value || originalValue;
}
```

### 3. 性能监控

#### 关键指标

```typescript
// 1. 数据库性能
interface DBMetrics {
  avgQueryTime: number;      // 平均查询时间
  p95QueryTime: number;      // 95%百分位查询时间
  slowQueries: number;       // 慢查询数（>100ms）
  errorRate: number;         // 错误率
  cacheHitRate: number;      // 缓存命中率
}

// 2. 业务指标
interface BusinessMetrics {
  dailyGenerations: number;
  activeUsers: number;
  avgGenerationTime: number;
  tagSuccessRate: Record<string, number>;
  templateUsageRank: Array<{id, usage, success_rate}>;
}

// 3. 系统指标
interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  connectionPoolSize: number;
  diskUsage: number;
}

// 监控实现
class MetricsCollector {
  async collectMetrics() {
    return {
      db: await this.collectDBMetrics(),
      business: await this.collectBusinessMetrics(),
      system: await this.collectSystemMetrics(),
    };
  }
  
  async reportMetrics() {
    const metrics = await this.collectMetrics();
    // 发送到监控系统（如 Datadog, New Relic）
    await monitoringService.report(metrics);
  }
}
```

#### 告警规则

```
1. 数据库连接
   - 告警: 连接使用率 > 80%
   - 建议: 增加连接池或分库

2. 查询性能
   - 告警: 慢查询 (>500ms) 增加 > 50%
   - 建议: 分析查询计划、添加索引

3. 数据库大小
   - 告警: 表大小增速 > 100MB/天
   - 建议: 评估分表分区策略

4. 缓存失效率
   - 告警: 缓存命中率 < 50%
   - 建议: 调整缓存TTL、预热热数据

5. 业务指标
   - 告警: 标签成功率 < 60%
   - 建议: 评估标签定义、收集更多反馈
```

---

## 总结与行动计划

### 当前优点 ✓

1. **清晰的分层架构**
   - Repository层纯数据访问
   - Service层业务逻辑
   - 单一职责原则

2. **完善的类型系统**
   - TypeScript 完全类型覆盖
   - Supabase 生成类型定义
   - 编译时错误检测

3. **异步非阻塞操作**
   - 生成后异步更新统计
   - Promise.allSettled处理多个异步操作

4. **缓存策略**
   - 用户信息5分钟缓存
   - 热门模板缓存

5. **多认证方式支持**
   - 设备指纹、OAuth、多账号绑定
   - 灵活的用户合并策略

### 需要改进的地方 ⚠️

1. **缺乏数据库事务**
   - 异步操作失败未能回滚
   - 建议：使用Supabase RPC函数

2. **缺乏全文搜索索引**
   - ILIKE模糊搜索性能差
   - 建议：添加GIN索引，使用tsvector

3. **缺乏监控和日志**
   - 无性能监控
   - 无错误追踪
   - 建议：集成Sentry或Datadog

4. **数据一致性未保证**
   - 并发更新可能不安全
   - 建议：添加乐观锁或版本号

5. **缺乏数据备份策略**
   - 未见备份配置
   - 建议：启用PITR，定期导出

### 优先级行动计划

**P0 (立即执行)**
1. 添加关键表的索引
2. 实现数据库监控告警
3. 添加错误重试机制

**P1 (本月内)**
1. 重构异步操作使用RPC函数
2. 实现完整的缓存预热
3. 添加慢查询日志分析

**P2 (下个月)**
1. 实现全文搜索功能
2. 优化推荐算法
3. 添加多语言支持

**P3 (长期规划)**
1. 分库分表策略
2. 读写分离
3. 实时推送功能

