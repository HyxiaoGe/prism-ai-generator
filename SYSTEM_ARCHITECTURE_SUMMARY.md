# 系统架构总结 - 提示词优化和标签系统

## 核心文件清单

### 标签系统
| 文件 | 行数 | 功能 |
|------|------|------|
| `/frontend/src/constants/tags.ts` | 304 | 标签定义、映射、辅助函数 |
| `/frontend/src/services/business/tagService.ts` | 192 | 标签统计业务逻辑 |
| `/frontend/src/services/business/tagMappingService.ts` | 321 | 标签展开和映射服务 |
| `/frontend/src/repositories/tagRepository.ts` | 100+ | 标签数据库操作 |

### 提示词优化
| 文件 | 行数 | 功能 |
|------|------|------|
| `/frontend/src/features/ai-models/components/PromptAssistant.tsx` | 905 | AI助手UI组件 |
| `/frontend/src/features/ai-models/services/PromptOptimizer.ts` | 283 | 优化和分析服务 |
| `/frontend/src/features/ai-models/utils/promptParser.ts` | 388 | 提示词解析工具 |
| `/netlify/functions/optimize-prompt.js` | 423 | LLM优化函数 |
| `/netlify/functions/analyze-prompt.js` | 266 | 提示词分析函数 |
| `/netlify/functions/prompt-suggestions.js` | 150+ | 实时建议函数 |

### 场景包和模板
| 文件 | 行数 | 功能 |
|------|------|------|
| `/frontend/src/constants/scenePacks.ts` | 200+ | 场景包定义 |
| `/frontend/src/services/business/sceneTemplateService.ts` | 432 | 模板业务逻辑 |
| `/frontend/src/repositories/sceneTemplateRepository.ts` | 150+ | 模板数据库操作 |

### UI组件
| 文件 | 行数 | 功能 |
|------|------|------|
| `/frontend/src/features/ai-models/components/PromptInput.tsx` | 400+ | 主输入组件 |
| `/frontend/src/features/ai-models/components/PromptFeatures.tsx` | 200+ | 特征显示组件 |
| `/frontend/src/features/ai-models/components/TagSelectorGroup.tsx` | 150+ | 标签选择器 |

### 状态管理
| 文件 | 行数 | 功能 |
|------|------|------|
| `/frontend/src/store/aiGenerationStore.ts` | 616 | 全局状态管理 |
| `/frontend/src/features/ai-models/services/aiService.ts` | 150+ | AI服务接口 |

---

## 关键数据流

### 标签系统数据流
```
用户界面 (UI)
    ↓
标签选择器 (TagSelectorGroup)
    ↓
状态管理 (useAIGenerationStore)
    ├─ selectedArtStyle (string)
    ├─ selectedThemeStyle (string)
    ├─ selectedMood (string)
    ├─ selectedTechnical (string[])
    ├─ selectedComposition (string[])
    └─ selectedEnhancements (string[])
    ↓
标签映射 (TagMappingService)
    ├─ expandScenePackTags()
    └─ buildFullPrompt()
    ↓
完整生成提示词
```

### 提示词优化数据流
```
用户输入提示词
    ↓
PromptAssistant 组件
    ├─ 用户点击「分析」
    │   ↓
    │   PromptOptimizer.analyzePrompt()
    │   ↓
    │   /netlify/functions/analyze-prompt
    │   ↓
    │   LLM分析 (Deepseek)
    │   ↓
    │   返回分析结果 (5维度评分)
    │
    └─ 用户点击「优化」
        ↓
        PromptOptimizer.optimizePrompt()
        ├─ 传入分析结果（previousAnalysis）
        ↓
        /netlify/functions/optimize-prompt
        ↓
        LLM优化 (Claude/GPT/Deepseek)
        ├─ 语言策略选择
        ├─ 针对性优化
        └─ 标签建议
        ↓
        返回优化结果
        ├─ optimizedPrompt: 完整提示词
        ├─ suggestedTags: 建议标签
        └─ improvements: 改进说明
        ↓
        PromptParser.parseOptimizedPrompt()
        ├─ 分离核心描述和标签
        ├─ 自动匹配标签
        └─ 提取基础提示词
        ↓
        应用到UI和状态
```

### 场景包应用流程
```
用户选择场景包
    ↓
SceneTemplateBrowser 组件
    ↓
SceneTemplateService.applyTemplate()
    ├─ 获取模板详情
    ├─ 展开标签配置
    ├─ 构建完整提示词
    └─ 记录使用历史（异步）
    ↓
返回应用结果
    ├─ basePrompt: 基础提示词
    ├─ fullPrompt: 完整提示词
    └─ suggestedTags: 建议的标签配置
    ↓
更新 UI 和状态
    ├─ 更新提示词
    ├─ 自动选择标签
    └─ 显示示例图片
```

---

## 核心算法对比

### 标签匹配 vs 提示词提取

| 功能 | 标签匹配 | 提示词提取 |
|------|---------|----------|
| **目标** | 将变体标签映射到预定义标签 | 从完整提示词中提取核心描述 |
| **输入** | 标签字符串（可能是简化形式） | 完整生成提示词（100+单词） |
| **算法** | 模糊匹配 + 阈值判断 | 术语库匹配 + 正则清理 |
| **复杂度** | O(n*m) n=输入长度, m=标签数 | O(n) n=提示词长度 |
| **准确率** | 相对较高（>80%） | 很高（>95%） |
| **应用场景** | AI输出→预定义标签 | 优化提示词→用户编辑 |

---

## 性能指标

### API响应时间
- 分析提示词: 3-5秒 (LLM调用)
- 优化提示词: 5-8秒 (LLM调用)
- 获取建议: <1秒 (规则或缓存)
- 标签统计: <100ms (本地或缓存)

### 内存使用
- 标签缓存 (TagMappingService): ~2MB (70+ 标签)
- 模板缓存 (SceneTemplateService): ~5MB (5分钟)
- 提示词缓存 (PromptOptimizer): ~10MB (可配置)

### 数据库查询
- 获取热门标签: <50ms
- 标签推荐查询: <100ms
- 模板搜索: <200ms
- 批量标签更新: 1次请求 (upsert)

---

## 扩展点和集成指南

### 添加新标签
1. 在 `/frontend/src/constants/tags.ts` 中添加到对应的标签组
2. 添加到 `TAG_NAME_MAP` 映射
3. 在 `promptParser.ts` 中添加匹配规则
4. （可选）在 `scenePacks.ts` 中引用

示例：
```typescript
// 1. 添加新标签
export const ART_STYLE_TAGS: Tag[] = [
  // ... 现有标签
  { 
    label: '新风格',
    value: 'new style keywords, descriptive',
    displayValue: '新风格描述'
  }
];

// 2. 添加映射
TAG_NAME_MAP['new style keywords, descriptive'] = '新风格';

// 3. 添加解析规则（promptParser.ts）
if (normalizedValue.includes('new style')) {
  return { label: '新风格', icon: '✨', color: 'blue' };
}
```

### 添加新场景包
1. 在 `scenePacks.ts` 中添加新的 `ScenePack` 对象
2. 定义标签配置（引用现有标签值）
3. 提供示例和提示信息

示例：
```typescript
{
  id: 'custom-scene-1',
  name: '自定义场景',
  nameEn: 'Custom Scene',
  icon: '🎨',
  category: 'art',
  // ... 其他配置
  tags: {
    artStyle: 'photorealistic',  // 使用完整的tag.value
    technical: ['85mm lens, portrait lens, shallow depth of field'],
    enhancement: ['highly detailed, intricate details, ultra-detailed textures, photorealistic details']
  }
}
```

### 集成新的LLM模型
1. 在 `optimize-prompt.js` 中更新 `LLM_MODELS`
2. 在优化提示词中选择模型
3. 测试输出格式兼容性

```javascript
const LLM_MODELS = {
  'claude-3': 'anthropic/claude-3-5-sonnet-20241022',
  'new-model': 'vendor/model-name',
  'default': 'deepseek-ai/deepseek-v3'
};
```

### 自定义分析标准
修改 `analyze-prompt.js` 中的评分规则：
- 调整权重系数
- 修改阈值
- 增加新的评分维度

---

## 最佳实践

### 1. 提示词编写
```
基础结构：
[核心描述], [艺术风格], [主题风格], [情绪氛围], [技术参数], [构图], [增强效果]

例子：
一个穿着红色连衣裙的女性,
photorealistic, cinematic photography,
sci-fi, futuristic,
warm lighting, dramatic,
85mm lens, shallow depth of field,
rule of thirds,
highly detailed, professional quality
```

### 2. 标签选择策略
- **必选**: 艺术风格、情绪氛围（单选1个）
- **推荐**: 主题风格（单选1个）
- **可选**: 技术参数、构图、增强效果（多选0-3个）

### 3. AI优化使用
- 分析评分 < 60：强烈建议优化
- 分析评分 60-90：可考虑优化
- 分析评分 > 90：无需优化

### 4. 缓存策略
- 分析和优化结果：按session缓存
- 模板列表：5分钟刷新
- 标签映射：应用启动时初始化

---

## 故障排除

### 常见问题

**Q: 标签不匹配怎么办？**
A: 检查 `TAG_NAME_MAP` 中是否存在该映射，或在 `promptParser.ts` 中添加模糊匹配规则。

**Q: AI优化输出格式错误？**
A: 检查 LLM 返回的 JSON 格式，确保包含必要的字段（optimizedPrompt, suggestedTags）。

**Q: 性能缓慢？**
A: 检查缓存是否启用，验证 API 调用防抖配置，考虑启用虚拟滚动。

**Q: 标签统计不更新？**
A: 确保 `TagService.updateTagStats()` 在生成完成后被调用，检查数据库连接。

---

## 监控和调试

### 关键日志位置
- 前端：浏览器 DevTools Console
- 后端：Netlify Functions 日志
- 数据库：Supabase SQL 编辑器

### 调试提示
```javascript
// 在 PromptOptimizer 中添加调试
console.log('🤖 开始优化:', { prompt, targetModel, options });
console.log('✅ 优化完成:', suggestion);

// 在 tagMappingService 中添加调试
console.log('🔍 查找标签:', simpleValue, 'in', category);
console.log('✅ 找到匹配:', expandedTag);

// 在 promptParser 中添加调试
console.log('🧠 解析结果:', result);
```

