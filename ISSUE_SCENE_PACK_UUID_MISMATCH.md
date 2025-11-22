# 场景包UUID不匹配问题分析

## 问题描述

从首页选择场景包后，点击"下一步"进入AI图像生成模块，QuickModePanel无法自动选中对应的场景包，底部按钮显示"请输入提示词"而不是"开始生成"。

## 根本原因分析

### 数据源不一致导致的ID格式冲突

**首页组件**（TemplateShowcase.tsx）：
```typescript
// 使用数据库加载场景包
const templates = await sceneTemplateService.getAllTemplates('popular');
// 返回的ID格式：UUID
// 例如：'94eaa038-ce75-47d0-a9e0-250612b6abc8'
```

**QuickModePanel组件**：
```typescript
// 使用硬编码的SCENE_PACKS
import { SCENE_PACKS } from '@/constants/scenePacks';
// ID格式：字符串slug
// 例如：'portrait-photography', 'landscape-epic'
```

**问题代码**（QuickModePanel.tsx:37）：
```typescript
const pack = SCENE_PACKS.find(p => p.id === selectedScenePackId);
// ❌ 永远找不到！
// 因为: 'portrait-photography' !== '94eaa038-ce75-47d0-a9e0-250612b6abc8'
```

**控制台输出证据**：
```
🔍 QuickModePanel useEffect triggered: {
  selectedScenePackId: '94eaa038-ce75-47d0-a9e0-250612b6abc8',  // UUID格式
  selectedPackId: undefined,
  hasOnPromptChange: true
}
⚠️  未找到场景包: 94eaa038-ce75-47d0-a9e0-250612b6abc8
```

## 附加问题

### flux-dev模型硬编码

数据库迁移脚本 `03_scene_pack_usage_and_sync.sql` 中有4个场景包使用了不存在的 `flux-dev` 模型：
- 人像摄影 (line 64)
- 国风插画 (line 137)
- 产品摄影 (line 209)
- 古典油画 (line 279)

数据库只有以下模型：
- `flux-schnell`
- `imagen-4-ultra`

这导致生成请求失败：`Error: 模型 flux-dev 不存在`

## 解决方案

### 方案1：统一使用数据库（推荐）✅

**优势**：
- 生产最佳实践
- 单一数据源
- 易于维护和扩展
- 支持动态更新

**实施步骤**：

1. **修复数据库迁移脚本**
```sql
-- 将flux-dev改为flux-schnell，步数从28改为4
UPDATE scene_templates
SET recommended_model = 'flux-schnell', recommended_steps = 4
WHERE recommended_model = 'flux-dev' AND is_official = true;
```

2. **重构QuickModePanel**
```typescript
// 改为从数据库加载
import { SceneTemplateService } from '@/services/business/sceneTemplateService';
import type { SceneTemplate } from '@/types/database';

const [scenePacks, setScenePacks] = useState<SceneTemplate[]>([]);

useEffect(() => {
  const loadScenePacks = async () => {
    const templates = await sceneTemplateService.browseTemplates({
      isOfficial: true,
      sortBy: 'popular',
    });
    setScenePacks(templates);
  };
  loadScenePacks();
}, []);

// 查找时使用UUID
const pack = scenePacks.find(p => p.id === selectedScenePackId);
```

3. **适配数据库字段名**
```typescript
// 硬编码字段 → 数据库字段映射
nameEn → name_en
icon → icon
preview → thumbnail_url
recommendedModel → recommended_model
recommendedAspectRatio → recommended_aspect_ratio
recommendedSteps → recommended_steps
tags → suggested_tags (JSONB对象)
examples → examples (数组)
tips → tips
```

4. **更新ScenePackCard组件**
```typescript
// 支持SceneTemplate类型
interface ScenePackCardProps {
  pack: SceneTemplate;  // 改为数据库类型
  // ...
}
```

### 方案2：首页也使用硬编码（不推荐）❌

**缺点**：
- 违背数据驱动原则
- 难以动态更新
- 维护成本高

## 影响范围

### 需要修改的文件

1. **数据库迁移脚本**：
   - `database/migrations/03_scene_pack_usage_and_sync.sql`
   - `database/migrations/04_fix_flux_dev_in_scene_templates.sql`（新建）

2. **前端组件**：
   - `frontend/src/features/ai-models/components/QuickModePanel.tsx`
   - `frontend/src/features/ai-models/components/ScenePackCard.tsx`

3. **不需要修改**（已使用数据库）：
   - `frontend/src/components/home/TemplateShowcase.tsx`
   - `frontend/src/components/home/TemplateCard.tsx`

## 实施清单

- [x] 分析SCENE_PACKS和SceneTemplate数据结构差异
- [x] 创建04_fix_flux_dev_in_scene_templates.sql更新脚本
- [x] 修复03_scene_pack_usage_and_sync.sql中的flux-dev引用
- [ ] 重构QuickModePanel从数据库加载场景包
- [ ] 重构ScenePackCard支持数据库类型
- [ ] 测试完整流程（首页→选择场景包→快速生成）
- [ ] 提交代码并推送

## 技术债务

考虑在未来版本中：
1. 删除或标记废弃 `frontend/src/constants/scenePacks.ts`
2. 添加前端缓存优化场景包加载性能
3. 统一所有组件使用SceneTemplateService

## 相关文件

- **数据库Schema**: `frontend/src/types/database.ts`
- **场景模板服务**: `frontend/src/services/business/sceneTemplateService.ts`
- **硬编码常量**: `frontend/src/constants/scenePacks.ts`（待废弃）
