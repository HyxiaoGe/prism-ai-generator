/**
 * AI驱动的提示词优化服务
 * 集成Replicate上的LLM模型，提供智能提示词建议和优化
 */

export interface PromptSuggestion {
  optimizedPrompt: string;
  improvements: string[];
  confidence: number;
  reasoning: string;
  suggestedTags: {
    artStyle?: string;
    themeStyle?: string;
    mood?: string;
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
  };
}

export interface PromptAnalysis {
  clarity: number;          // 清晰度评分 0-100
  specificity: number;      // 具体性评分 0-100
  creativity: number;       // 创意性评分 0-100
  technical: number;        // 技术完整性评分 0-100
  overall: number;         // 综合评分 0-100
  weaknesses: string[];    // 弱点分析
  strengths: string[];     // 优势分析
  suggestions?: string[];  // 改进建议列表（可选）
  missingElements?: string[]; // 缺失元素
}

// 🌐 新增：翻译结果接口
export interface TranslationResult {
  originalPrompt: string;
  chineseTranslation: string;
  explanation: string;
  keyTerms: Array<{
    english: string;
    chinese: string;
  }>;
  confidence: number;
}

export class PromptOptimizer {
  private static instance: PromptOptimizer;
  private readonly API_BASE_URL = '/.netlify/functions';
  private cache = new Map<string, PromptSuggestion>();

  static getInstance(): PromptOptimizer {
    if (!PromptOptimizer.instance) {
      PromptOptimizer.instance = new PromptOptimizer();
    }
    return PromptOptimizer.instance;
  }

  /**
   * 智能提示词优化 - 使用Claude/GPT等LLM
   */
  async optimizePrompt(
    originalPrompt: string,
    targetModel: string,
    options: {
      style?: 'creative' | 'technical' | 'balanced';
      focus?: 'quality' | 'speed' | 'creativity';
      language?: 'en' | 'zh' | 'auto';
      previousAnalysis?: PromptAnalysis;
    } = {}
  ): Promise<PromptSuggestion> {
    const cacheKey = `${originalPrompt}_${targetModel}_${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    console.log('🤖 开始AI提示词优化...');
    
    const response = await fetch(`${this.API_BASE_URL}/optimize-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: originalPrompt,
        targetModel,
        options,
        previousAnalysis: options.previousAnalysis
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`优化失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    const suggestion: PromptSuggestion = {
      optimizedPrompt: result.optimizedPrompt,
      improvements: result.improvements || [],
      confidence: result.confidence || 85,
      reasoning: result.reasoning || '基于最佳实践进行优化',
      suggestedTags: result.suggestedTags || {}
    };

    // 缓存结果
    this.cache.set(cacheKey, suggestion);
    
    console.log('✅ 提示词优化完成:', suggestion);
    return suggestion;
  }

  /**
   * 实时提示词分析和建议
   */
  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    const response = await fetch(`${this.API_BASE_URL}/analyze-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`分析失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * 获取智能建议 - 基于用户输入提供实时建议
   */
  async getSuggestions(
    partialPrompt: string,
    context: {
      selectedTags?: any;
      targetModel?: string;
      recentHistory?: string[];
    } = {}
  ): Promise<string[]> {
    const response = await fetch(`${this.API_BASE_URL}/prompt-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialPrompt,
        context,
        maxSuggestions: 5
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`获取建议失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    return result.suggestions || [];
  }

  /**
   * 根据成功案例生成最佳模板
   */
  async generateBestPracticeTemplate(
    theme: string,
    style: string,
    options: {
      complexity?: 'simple' | 'detailed' | 'advanced';
      audience?: 'beginner' | 'intermediate' | 'expert';
    } = {}
  ): Promise<{
    template: string;
    explanation: string;
    examples: string[];
    tags: any;
  }> {
    const response = await fetch(`${this.API_BASE_URL}/generate-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme,
        style,
        options,
        successCases: await this.getSuccessfulPrompts()
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`模板生成失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * 修复常见问题 - 自动识别和修复提示词中的常见问题
   */
  async fixCommonIssues(prompt: string): Promise<{
    fixedPrompt: string;
    issues: Array<{
      type: string;
      description: string;
      fix: string;
    }>;
  }> {
    const response = await fetch(`${this.API_BASE_URL}/fix-prompt-issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        // 包含常见问题类型
        checkTypes: [
          'repetition',      // 重复词汇
          'ambiguity',       // 模糊描述
          'incompleteness',  // 不完整信息
          'inefficiency',    // 低效词汇
          'formatting'       // 格式问题
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`修复失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * 🌐 翻译英文提示词为中文
   */
  async translatePrompt(englishPrompt: string): Promise<TranslationResult> {
    const cacheKey = `translate_${englishPrompt}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)! as any;
    }

    console.log('🌐 开始翻译英文提示词...');
    
    const response = await fetch(`${this.API_BASE_URL}/translate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        englishPrompt: englishPrompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`翻译失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result: TranslationResult = await response.json();
    
    // 缓存翻译结果
    this.cache.set(cacheKey, result as any);
    
    console.log('✅ 翻译完成');
    return result;
  }

  // 私有辅助方法
  private async getCurrentTrends(): Promise<any> {
    // 这里可以从数据库或API获取当前流行趋势
    // 暂时返回静态数据
    return {
      popular_styles: ['cyberpunk', 'dreamy', 'vintage'],
      trending_colors: ['neon', 'pastels', 'monochrome'],
      hot_topics: ['AI art', 'surrealism', 'minimalism']
    };
  }

  private async getUserPromptHistory(): Promise<string[]> {
    // 从本地存储获取用户历史提示词
    const history = localStorage.getItem('prompt_history');
    return history ? JSON.parse(history) : [];
  }

  private async getSuccessfulPrompts(): Promise<Array<{ prompt: string; feedback: string }>> {
    // 获取成功案例 - 可以从数据库或本地存储获取
    const successCases = localStorage.getItem('successful_prompts');
    return successCases ? JSON.parse(successCases) : [];
  }
} 