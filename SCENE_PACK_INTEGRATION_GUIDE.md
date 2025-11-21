# 场景包与首页推荐集成指南

## 🎯 问题分析

目前系统存在**两个独立的内容推荐系统**：

### 1. 首页热门推荐（TemplateShowcase）
- **数据源**: Supabase 数据库 `scene_templates` 表
- **特点**: 动态内容，支持评分、统计、收藏
- **位置**: 首页自动轮播展示
- **数量**: 80+ 个模板（可持续增长）

### 2. 场景包系统（ScenePack）
- **数据源**: 硬编码 `scenePacks.ts` 文件
- **特点**: 精选内容，快速模式核心
- **位置**: 生成面板"快速生成"模式
- **数量**: 8 个精选场景包

## 💡 集成方案

我已经创建了 **ScenePackIntegrationService** 来打通这两个系统。

### 核心功能

```typescript
// 1. 统一应用场景包或模板
await scenePackIntegration.applyItem(item);

// 2. 获取混合推荐（场景包 + 数据库模板）
const recommendations = await scenePackIntegration.getHomepageRecommendations(12);

// 3. 判断类型
if (scenePackIntegration.isScenePack(item)) {
  // 是场景包
} else {
  // 是数据库模板
}

// 4. 场景包转模板格式（用于统一展示）
const templateFormat = scenePackIntegration.scenePackToTemplate(scenePack);
```

## 🔧 实施步骤

### 步骤 1: 修改 App.tsx 的模板点击处理

**现有代码** (`frontend/src/App.tsx` 行 146-168):
```typescript
const handleTemplateClick = async (template: any | SceneTemplate) => {
  if ('id' in template && template.id) {
    // 数据库模板
    const { basePrompt, suggestedTags } = await templateService.applyTemplate(template.id);
    setSidebarPrompt(basePrompt);
    setSuggestedTags(suggestedTags);
    setShowSettings(true);
  } else {
    // 硬编码模板（向后兼容）
    setSidebarPrompt(template.prompt);
    setSuggestedTags(template.suggestedTags);
    setShowSettings(true);
  }
};
```

**建议修改为**:
```typescript
import { scenePackIntegration } from './services/business/scenePackIntegrationService';

const handleTemplateClick = async (template: any) => {
  try {
    // 使用集成服务统一处理
    const { basePrompt, suggestedTags, config } = await scenePackIntegration.applyItem(template);

    setSidebarPrompt(basePrompt);
    setSuggestedTags(suggestedTags);

    // 如果是场景包，还要应用额外配置
    if (config) {
      const { updateConfig } = useAIGenerationStore.getState();
      updateConfig(config);
    }

    setShowSettings(true);
  } catch (error) {
    console.error('应用模板失败:', error);
    toast.error('模板加载失败', '请重试或选择其他模板');
  }
};
```

### 步骤 2: 首页展示混合内容（可选）

有两种方案：

#### 方案 A: 首页只展示数据库模板（推荐）
- **优点**: 数据库内容更丰富，可动态更新
- **缺点**: 场景包和首页分离
- **实施**: 保持现状，无需修改

#### 方案 B: 首页混合展示场景包和模板
- **优点**: 场景包获得更多曝光
- **缺点**: 需要修改 TemplateShowcase

**如果选择方案 B**，修改 `TemplateShowcase.tsx`:

```typescript
import { scenePackIntegration } from '../../services/business/scenePackIntegrationService';

const loadTemplates = async () => {
  try {
    setLoading(true);

    // 使用集成服务获取混合推荐
    const recommendations = await scenePackIntegration.getHomepageRecommendations(12);

    // 场景包和模板混合展示
    setFeaturedTemplates(recommendations);

    // ... 其他逻辑
  } catch (error) {
    console.error('加载失败:', error);
  } finally {
    setLoading(false);
  }
};
```

### 步骤 3: 场景包使用统计（可选）

**创建数据库表** (`scene_pack_stats`):

```sql
CREATE TABLE scene_pack_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pack_id TEXT NOT NULL,           -- 场景包ID
  user_id UUID REFERENCES users(id),
  usage_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_scene_pack_stats_pack_id ON scene_pack_stats(pack_id);
CREATE INDEX idx_scene_pack_stats_user_id ON scene_pack_stats(user_id);
```

**或者复用 user_events 表**:

```typescript
// 在 scenePackIntegrationService.ts 中实现
async trackScenePackUsage(scenePackId: string, userId: string) {
  await supabase.from('user_events').insert({
    user_id: userId,
    event_type: 'scene_pack_used',
    event_data: { pack_id: scenePackId },
  });
}
```

### 步骤 4: 场景包导出到数据库（长期方案）

**迁移脚本** (`migrate_scene_packs_to_db.ts`):

```typescript
import { SCENE_PACKS } from './constants/scenePacks';
import { supabase } from './config/supabase';

async function migrateScenePacks() {
  for (const pack of SCENE_PACKS) {
    const template = {
      name: pack.name,
      description: pack.description,
      category: pack.category,
      difficulty: pack.difficulty,
      base_prompt: pack.examples[0] || '',
      suggested_tags: {
        art_style: pack.tags.artStyle ? [pack.tags.artStyle] : [],
        theme_style: pack.tags.themeStyle ? [pack.tags.themeStyle] : [],
        mood: pack.tags.mood ? [pack.tags.mood] : [],
        technical: pack.tags.technical || [],
        composition: pack.tags.composition || [],
        enhancement: pack.tags.enhancement || [],
      },
      thumbnail_url: pack.preview,
      example_images: [],
      usage_count: pack.usageCount || 0,
      is_official: true,
      is_public: true,
      status: 'active',
      // 扩展字段（需要添加到数据库表）
      scene_pack_config: {
        recommended_model: pack.recommendedModel,
        recommended_aspect_ratio: pack.recommendedAspectRatio,
        recommended_steps: pack.recommendedSteps,
      },
    };

    await supabase.from('scene_templates').insert(template);
  }
}
```

## 📊 推荐实施优先级

### P0 - 立即实施（本周）
- [x] 创建 ScenePackIntegrationService ✓
- [ ] 修改 App.tsx 使用统一的 applyItem 方法
- [ ] 测试场景包和模板点击都能正常工作

### P1 - 短期优化（1-2周）
- [ ] 场景包使用统计（复用 user_events 表）
- [ ] 在首页混合展示场景包和模板（可选）
- [ ] 数据分析：场景包 vs 模板的使用率对比

### P2 - 中期优化（1-2月）
- [ ] 将场景包数据迁移到数据库
- [ ] 扩展 scene_templates 表支持场景包配置
- [ ] 统一管理所有推荐内容

### P3 - 长期规划（3-6月）
- [ ] 用户自定义场景包
- [ ] 场景包社区分享和投票
- [ ] AI 自动生成场景包推荐

## 🎨 用户体验优化建议

### 1. 首页突出场景包
在首页顶部添加"快速开始"区域：

```tsx
<div className="quick-start-section mb-8">
  <h3 className="text-xl font-bold mb-4">⚡ 快速开始</h3>
  <div className="grid grid-cols-4 gap-4">
    {SCENE_PACKS.slice(0, 4).map(pack => (
      <ScenePackCard
        key={pack.id}
        pack={pack}
        compact={true}
        onSelect={() => handleTemplateClick(pack)}
      />
    ))}
  </div>
  <button onClick={() => setShowAllScenePacks(true)}>
    查看全部 8 个场景包 →
  </button>
</div>
```

### 2. 生成面板添加"来自首页"标签
如果用户从首页点击模板进入：

```tsx
{fromHomepage && (
  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
    <p className="text-sm text-blue-700">
      💡 您选择了模板：<strong>{templateName}</strong>
      <br/>
      已自动配置最佳参数，现在输入具体描述即可生成
    </p>
  </div>
)}
```

### 3. 统计和推荐优化
- 追踪：从首页进入 vs 直接使用场景包的转化率
- 优化：推荐用户最常用的场景包
- 个性化：根据历史推荐场景包

## 🔗 相关文件

### 新建文件
- `frontend/src/services/business/scenePackIntegrationService.ts` - 集成服务

### 需要修改的文件
- `frontend/src/App.tsx` - handleTemplateClick 方法
- `frontend/src/components/home/TemplateShowcase.tsx` - 可选：混合展示

### 参考文件
- `frontend/src/constants/scenePacks.ts` - 场景包定义
- `frontend/src/services/business/sceneTemplateService.ts` - 模板服务
- `frontend/src/types/database.ts` - 数据类型定义

## ✅ 测试清单

- [ ] 点击首页模板能正常应用
- [ ] 点击生成面板场景包能正常应用
- [ ] 两种方式生成的图片质量一致
- [ ] 场景包统计正常记录（如果实现）
- [ ] 首页混合展示正常（如果实现）

## 💡 总结

**短期方案**（推荐）:
1. 修改 App.tsx 使用 `scenePackIntegration.applyItem()`
2. 保持首页只展示数据库模板
3. 场景包作为快速模式的专属功能

**长期方案**:
1. 将场景包迁移到数据库
2. 统一所有推荐内容源
3. 首页和生成面板共享数据

这样既保持了系统灵活性，又为未来的统一管理做好了准备！
