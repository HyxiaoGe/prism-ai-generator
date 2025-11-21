# 实现示例和代码片段

## 1. 标签系统示例

### 1.1 标签定义示例
```typescript
// /frontend/src/constants/tags.ts

// 完整的标签定义
export const ART_STYLE_TAGS: Tag[] = [
  {
    label: '摄影级逼真',
    value: 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed',
    displayValue: '摄影级逼真效果'
  },
  {
    label: '电影级画质',
    value: 'cinematic photography, film photography, dramatic lighting, cinematic composition',
    displayValue: '电影级摄影画质'
  },
  // ... 更多标签
];

// 映射表
export const TAG_NAME_MAP: Record<string, string> = {
  'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed': '摄影级逼真',
  'cinematic photography, film photography, dramatic lighting, cinematic composition': '电影级画质',
  // ... 更多映射
};

// 辅助函数
export function getTagsByCategory(category: TagCategory): Tag[] {
  switch (category) {
    case 'art_style':
      return ART_STYLE_TAGS;
    case 'theme_style':
      return THEME_STYLE_TAGS;
    // ... 其他分类
    default:
      return [];
  }
}
```

### 1.2 标签映射服务示例
```typescript
// /frontend/src/services/business/tagMappingService.ts

export class TagMappingService {
  private lookupCache: Map<string, ExpandedTag> | null = null;

  // 初始化查找表（懒加载）
  private initializeLookupCache(): void {
    if (this.lookupCache) return;
    
    this.lookupCache = new Map();
    
    // 构建快速查找表
    for (const [category, tags] of Object.entries(this.tagsByCategory)) {
      for (const tag of tags) {
        // 支持完整值查找
        this.lookupCache.set(tag.value.toLowerCase(), {
          category: category as TagCategoryKey,
          label: tag.label,
          value: tag.value,
          displayValue: tag.displayValue,
        });
      }
    }
  }

  // 展开场景包标签
  expandScenePackTags(tags: {
    artStyle?: string;
    themeStyle?: string;
    mood?: string;
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
  }): TagExpansionResult {
    const expandedTags: ExpandedTag[] = [];
    const warnings: string[] = [];
    const promptParts: string[] = [];

    // 处理单选标签
    const singleSelectionCategories: Array<{ key: TagCategoryKey; value?: string }> = [
      { key: 'artStyle', value: tags.artStyle },
      { key: 'themeStyle', value: tags.themeStyle },
      { key: 'mood', value: tags.mood },
    ];

    for (const { key, value } of singleSelectionCategories) {
      if (!value) continue;
      
      const expanded = this.findTagBySimpleValue(value, key);
      if (expanded) {
        expandedTags.push(expanded);
        promptParts.push(expanded.value);
      } else {
        warnings.push(`未找到标签: ${key}="${value}"`);
        promptParts.push(value); // 降级处理
      }
    }

    return {
      fullPrompt: promptParts.join(', '),
      expandedTags,
      warnings,
    };
  }

  // 构建完整生成提示词
  buildFullPrompt(
    basePrompt: string,
    tags: Record<string, any>,
    customModifications?: string
  ): string {
    const parts: string[] = [];

    if (basePrompt?.trim()) {
      parts.push(basePrompt.trim());
    }

    const { fullPrompt } = this.expandScenePackTags(tags);
    if (fullPrompt) {
      parts.push(fullPrompt);
    }

    if (customModifications?.trim()) {
      parts.push(customModifications.trim());
    }

    return parts.join(', ');
  }
}
```

---

## 2. 提示词优化示例

### 2.1 分析函数示例
```javascript
// /netlify/functions/analyze-prompt.js

function buildAnalysisPrompt(userPrompt) {
  return `你是一个专业的AI图像生成提示词分析专家。请分析以下提示词的质量。

**待分析的提示词**：
"${userPrompt}"

**分析维度**：
1. **清晰度** (0-100): 描述是否明确、无歧义
2. **具体性** (0-100): 是否包含足够的细节信息  
3. **创意性** (0-100): 是否有独特或有趣的元素
4. **技术完整性** (0-100): 是否包含适当的技术参数

**请按以下JSON格式返回分析结果**：
\`\`\`json
{
  "clarity": 85,
  "specificity": 70,
  "creativity": 90,
  "technical": 60,
  "overall": 76,
  "strengths": ["优势点1", "优势点2"],
  "weaknesses": ["不足点1", "不足点2"],
  "suggestions": ["改进建议1", "改进建议2"],
  "missingElements": ["缺失元素1"]
}
\`\`\``;
}

function parseAnalysisResult(llmResponse, originalPrompt) {
  try {
    const jsonMatch = llmResponse.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
    
    if (!jsonMatch) {
      throw new Error('JSON格式未找到');
    }

    const parsed = JSON.parse(jsonMatch[1]);
    
    const analysis = {
      clarity: Math.min(Math.max(parsed.clarity || 0, 0), 100),
      specificity: Math.min(Math.max(parsed.specificity || 0, 0), 100),
      creativity: Math.min(Math.max(parsed.creativity || 0, 0), 100),
      technical: Math.min(Math.max(parsed.technical || 0, 0), 100),
      overall: 0,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      missingElements: Array.isArray(parsed.missingElements) ? parsed.missingElements : []
    };
    
    // 计算综合评分
    analysis.overall = Math.round(
      (analysis.clarity + analysis.specificity + analysis.creativity + analysis.technical) / 4
    );

    return analysis;
  } catch (error) {
    console.error('解析失败:', error);
    throw new Error(`解析分析结果失败: ${error.message}`);
  }
}
```

### 2.2 优化函数示例
```javascript
// /netlify/functions/optimize-prompt.js

function buildEnglishOptimizationPrompt(
  userPrompt, 
  targetModel, 
  options, 
  previousAnalysis, 
  analysisContext
) {
  return `You are a professional AI image generation prompt optimization expert. 
Please optimize the following prompt based on the analysis results.

**Original Prompt**:
"${userPrompt}"

**Target Model**: ${targetModel}
${getModelCharacteristics(targetModel, 'en')}
${analysisContext}

**Optimization Requirements**:
- Style: ${options.style}
- Focus: ${options.focus}
- Maintain original intent while enhancing details
- Avoid repetitive content

**Complete Predefined Professional Tags System**:

**艺术风格标签 (单选)**:
${[
  'photorealistic', 'cinematic', 'oil-painting', 'watercolor', 
  'anime', 'pixel-art', 'sketch', 'concept-art', '3d-render', 'impressionist'
].join(', ')}

**情绪氛围标签 (单选)**:
${[
  'warm-bright', 'dark-mysterious', 'dreamy', 'epic', 'peaceful', 
  'energetic', 'melancholic', 'luxurious', 'wild', 'futuristic-tech'
].join(', ')}

**Return in JSON format**:
\`\`\`json
{
  "optimizedPrompt": "Complete optimized prompt",
  "improvements": ["Improvement 1", "Improvement 2"],
  "confidence": 85,
  "reasoning": "Optimization approach explanation",
  "suggestedTags": {
    "artStyle": "photorealistic",
    "themeStyle": "sci-fi",
    "mood": "epic",
    "technical": ["85mm-lens", "golden-hour"],
    "composition": ["rule-of-thirds"],
    "enhancement": ["highly-detailed"]
  }
}
\`\`\``;
}
```

---

## 3. 提示词解析示例

### 3.1 基础提示词提取
```typescript
// /frontend/src/features/ai-models/utils/promptParser.ts

function extractBasePrompt(prompt: string): string {
  let basePrompt = prompt;
  
  // 完整的技术术语库
  const allTechnicalTerms = [
    // 艺术风格术语
    'photorealistic', 'hyperrealistic', 'professional photography', '8K',
    'cinematic photography', 'film photography', 'dramatic lighting',
    'oil painting', 'classical art', 'brush strokes',
    // ... 更多术语
    
    // 情绪氛围术语
    'warm lighting', 'bright', 'cheerful', 'golden hour',
    'dark', 'mysterious', 'moody lighting',
    // ... 更多术语
    
    // 技术参数术语
    '85mm lens', 'wide-angle lens', '24mm',
    'macro photography', 'shallow depth of field', 'bokeh',
    // ... 更多术语
  ];
  
  // 创建正则表达式
  const technicalRegexes = [
    // 匹配完整短语
    new RegExp(
      ',?\\s*(' + 
      allTechnicalTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + 
      ')(?=\\s*,|\\s*$)', 
      'gi'
    ),
    
    // 匹配单词
    new RegExp(
      '\\b(' + 
      allTechnicalTerms.filter(term => !term.includes(' ')).join('|') + 
      ')\\b', 
      'gi'
    ),
    
    // 匹配特殊模式
    /,?\s*\d+mm\b/gi,              // 镜头焦距
    /,?\s*f\/\d+\.?\d*/gi,         // 光圈值
    /,?\s*\d+k\b/gi,               // 分辨率
  ];
  
  // 应用所有清理规则
  technicalRegexes.forEach(regex => {
    basePrompt = basePrompt.replace(regex, '');
  });
  
  // 格式规范化
  basePrompt = basePrompt
    .replace(/,+\s*,+/g, ',')       // 多个逗号
    .replace(/^,+\s*|,+\s*$/g, '')  // 开头结尾逗号
    .replace(/\s+,/g, ',')          // 逗号前空格
    .replace(/,\s+/g, ', ')         // 逗号后空格
    .replace(/\s+/g, ' ')           // 多余空格
    .trim();
  
  return basePrompt;
}

// 使用示例
const fullPrompt = "a beautiful woman, photorealistic, cinematic photography, 85mm lens, golden hour, highly detailed, professional quality";
const basePrompt = extractBasePrompt(fullPrompt);
// 结果: "a beautiful woman"
```

### 3.2 提示词特征解析
```typescript
// /frontend/src/features/ai-models/utils/promptParser.ts

export function parsePromptFeatures(prompt: string, config: any): ParsedPromptFeatures {
  const lowerPrompt = prompt.toLowerCase();
  const features: ParsedPromptFeatures = {
    basePrompt: extractBasePrompt(prompt),
    enhancements: [],
    qualityEnhanced: false,
    model: config.model || 'unknown',
    aspectRatio: config.aspectRatio || '1:1',
    inferenceSteps: config.numInferenceSteps || 4,
  };

  // 艺术风格映射
  const ART_STYLE_MAP = new Map([
    ['photorealistic, hyperrealistic, professional photography, 8K ultra-detailed', 
     { label: '摄影级逼真效果', icon: '📸', color: 'blue' }],
    ['cinematic photography, film photography, dramatic lighting, cinematic composition', 
     { label: '电影级摄影画质', icon: '🎬', color: 'purple' }],
    // ... 更多映射
  ]);

  // 解析艺术风格（至少匹配2个关键词）
  for (const [key, value] of ART_STYLE_MAP) {
    const keywords = key.split(', ');
    const matchCount = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    if (matchCount >= 2) {
      features.artStyle = value;
      break;
    }
  }

  // 类似地解析其他维度...
  
  // 检查品质增强
  features.qualityEnhanced = lowerPrompt.includes('high quality') || 
                            lowerPrompt.includes('masterpiece') || 
                            lowerPrompt.includes('4k resolution');

  return features;
}
```

---

## 4. React组件示例

### 4.1 标签选择器组件
```typescript
// /frontend/src/features/ai-models/components/TagSelectorGroup.tsx

interface TagSelectorGroupProps {
  category: 'artStyle' | 'themeStyle' | 'mood' | 'technical' | 'composition' | 'enhancement';
  selectedValues: string | string[];
  onSelectionChange: (values: string | string[]) => void;
  multiSelect?: boolean;
  tags: Tag[];
}

export function TagSelectorGroup({
  category,
  selectedValues,
  onSelectionChange,
  multiSelect = false,
  tags
}: TagSelectorGroupProps) {
  const handleTagClick = (tagValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(selectedValues) ? selectedValues : [];
      const newValues = currentValues.includes(tagValue)
        ? currentValues.filter(v => v !== tagValue)
        : [...currentValues, tagValue];
      onSelectionChange(newValues);
    } else {
      onSelectionChange(tagValue);
    }
  };

  const isSelected = (tagValue: string) => {
    if (multiSelect) {
      return Array.isArray(selectedValues) && selectedValues.includes(tagValue);
    }
    return selectedValues === tagValue;
  };

  return (
    <div className="tag-selector-group">
      {tags.map(tag => (
        <button
          key={tag.value}
          onClick={() => handleTagClick(tag.value)}
          className={`tag-button ${isSelected(tag.value) ? 'selected' : ''}`}
          title={tag.displayValue}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}
```

### 4.2 PromptAssistant组件片段
```typescript
// /frontend/src/features/ai-models/components/PromptAssistant.tsx

export const PromptAssistant: React.FC<PromptAssistantProps> = ({
  prompt,
  onPromptChange,
  selectedModel,
  onApplyOptimization
}) => {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizer = PromptOptimizer.getInstance();

  // 分析提示词
  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const result = await optimizer.analyzePrompt(prompt);
      setAnalysis(result);
      
      // 如果评分低于90，显示优化建议
      if (result.overall < 90) {
        console.log('建议优化');
      }
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 优化提示词
  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    
    setIsOptimizing(true);
    try {
      const optimization = await optimizer.optimizePrompt(
        prompt,
        selectedModel || 'flux-schnell',
        {
          style: 'balanced',
          focus: 'quality',
          language: 'en',
          previousAnalysis: analysis // 传递分析结果
        }
      );
      
      if (onApplyOptimization) {
        const parsedResult = parseOptimizedPrompt(optimization.optimizedPrompt);
        onApplyOptimization(parsedResult);
      }
    } catch (error) {
      console.error('优化失败:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="prompt-assistant">
      {/* 分析结果展示 */}
      {analysis && (
        <div className="analysis-results">
          <div className="overall-score">
            总体评分: {analysis.overall}
          </div>
          <div className="dimension-scores">
            <div>清晰度: {analysis.clarity}</div>
            <div>具体性: {analysis.specificity}</div>
            <div>创意性: {analysis.creativity}</div>
            <div>技术完整性: {analysis.technical}</div>
          </div>
          {analysis.strengths.length > 0 && (
            <div className="strengths">
              <h4>优势</h4>
              <ul>
                {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {analysis.weaknesses.length > 0 && (
            <div className="weaknesses">
              <h4>待改进</h4>
              <ul>
                {analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <button onClick={handleAnalyze} disabled={isAnalyzing}>
        {isAnalyzing ? '分析中...' : '分析'}
      </button>
      <button onClick={handleOptimize} disabled={isOptimizing}>
        {isOptimizing ? '优化中...' : '优化'}
      </button>
    </div>
  );
};
```

---

## 5. 数据库操作示例

### 5.1 标签统计更新
```typescript
// /frontend/src/repositories/tagRepository.ts

async upsertMany(tags: TagInput[]): Promise<void> {
  if (!tags || tags.length === 0) return;

  const currentTime = new Date().toISOString();
  const upsertData = tags.map(tag => ({
    tag_name: tag.name,
    tag_category: tag.category,
    tag_value: tag.value,
    usage_count: 1,
    success_rate: 0,
    average_rating: 0,
    last_used: currentTime,
    updated_at: currentTime,
  }));

  // 使用 upsert 而不是逐个插入
  const { error } = await this.supabase
    .from('tag_stats')
    .upsert(upsertData, {
      onConflict: 'tag_name,tag_category',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`批量更新标签统计失败: ${error.message}`);
  }
}

// 在生成完成后调用
async updateTagStatsAfterGeneration(selectedTags: Record<string, any>) {
  const tags = [];
  
  if (selectedTags.artStyle) {
    tags.push({ name: '摄影级逼真', category: 'art_style', value: selectedTags.artStyle });
  }
  
  if (selectedTags.mood) {
    tags.push({ name: '温暖明亮', category: 'mood', value: selectedTags.mood });
  }
  
  // ... 更多标签
  
  await tagService.updateTagStats(tags);
}
```

### 5.2 模板使用记录
```typescript
// /frontend/src/repositories/sceneTemplateRepository.ts

async recordUsage(
  userId: string,
  templateId: string,
  options: {
    customModifications?: string;
    generationId?: string;
    wasSuccessful?: boolean;
    userRating?: number;
  }
): Promise<void> {
  const { error } = await this.supabase
    .from('template_usage_history')
    .insert({
      user_id: userId,
      template_id: templateId,
      generation_id: options.generationId,
      custom_modifications: options.customModifications,
      was_successful: options.wasSuccessful,
      user_rating: options.userRating,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('记录模板使用失败:', error);
  }
}
```

---

## 6. 状态管理示例

### 6.1 Zustand Store
```typescript
// /frontend/src/store/aiGenerationStore.ts

export const useAIGenerationStore = create<AIGenerationState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      currentConfig: defaultConfig,
      currentGeneration: initialGenerationStatus,
      
      // 更新配置
      updateConfig: (config) =>
        set(
          (state) => ({
            currentConfig: { ...state.currentConfig, ...config }
          }),
          false,
          'updateConfig'
        ),

      // 启动生成
      startGeneration: async (config) => {
        set(
          (state) => ({
            currentGeneration: {
              isGenerating: true,
              progress: 0,
              stage: 'processing',
              error: null,
            },
            currentConfig: { ...state.currentConfig, ...config }
          }),
          false,
          'startGeneration'
        );

        try {
          const results = await AIService.generateImage(config);
          get().completeGeneration(results);
        } catch (error) {
          get().failGeneration(error.message);
        }
      },

      // 完成生成
      completeGeneration: (results) => {
        const state = get();
        set(
          (state) => ({
            currentGeneration: {
              ...state.currentGeneration,
              isGenerating: false,
              progress: 100,
              error: null,
            },
            generationHistory: [
              {
                prompt: results[0].prompt,
                config: state.currentConfig,
                results,
                createdAt: new Date(),
              },
              ...state.generationHistory,
            ]
          }),
          false,
          'completeGeneration'
        );
      },
    }),
    { name: 'AIGenerationStore' }
  )
);
```

---

## 7. 最佳实践示例

### 7.1 错误处理
```typescript
async function optimizePromptWithErrorHandling(prompt: string) {
  try {
    const optimizer = PromptOptimizer.getInstance();
    const result = await optimizer.optimizePrompt(prompt, 'flux-schnell');
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API调用失败')) {
        // 处理API错误
        console.error('API服务暂不可用，请稍后重试');
        return fallbackOptimization(prompt);
      } else if (error.message.includes('超时')) {
        // 处理超时
        console.error('优化请求超时');
        return null;
      } else {
        // 处理其他错误
        console.error('优化失败:', error.message);
        return null;
      }
    }
  }
}

// 降级方案
function fallbackOptimization(prompt: string) {
  return {
    optimizedPrompt: prompt,
    improvements: [],
    confidence: 0,
    reasoning: '离线模式：使用原始提示词',
    suggestedTags: {}
  };
}
```

### 7.2 性能监测
```typescript
async function optimizePromptWithMetrics(prompt: string, model: string) {
  const startTime = performance.now();
  
  try {
    const optimizer = PromptOptimizer.getInstance();
    const result = await optimizer.optimizePrompt(prompt, model);
    
    const duration = performance.now() - startTime;
    
    // 记录性能指标
    console.log('优化耗时:', duration, 'ms');
    console.log('提示词长度:', prompt.length);
    console.log('优化后长度:', result.optimizedPrompt.length);
    
    // 发送到分析服务（可选）
    if (duration > 5000) {
      console.warn('优化耗时较长，可能影响用户体验');
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error('优化失败，耗时:', duration, 'ms');
    throw error;
  }
}
```

