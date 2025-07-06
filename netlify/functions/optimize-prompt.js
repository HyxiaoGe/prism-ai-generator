/**
 * AI提示词优化服务 - 集成Replicate LLM模型
 * 使用Claude、GPT等模型来优化图像生成提示词
 */

// 直接使用REST API，不依赖replicate库

// 支持的LLM模型配置
const LLM_MODELS = {
  'claude-3': 'anthropic/claude-3-5-sonnet-20241022',
  'llama-3.1': 'meta/meta-llama-3.1-405b-instruct', 
  'gpt-4': 'openai/gpt-4-turbo-preview',
  // 默认使用性价比较高的模型
  'default': 'deepseek-ai/deepseek-v3'
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      prompt, 
      targetModel, 
      options = {},
      previousAnalysis = null
    } = JSON.parse(event.body);

    console.log('🚀 开始提示词优化:', { prompt, targetModel, options, previousAnalysis });

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '提示词不能为空' })
      };
    }

    // 构建优化提示词 - 传递分析结果
    const optimizationPrompt = buildOptimizationPrompt(prompt, targetModel, options, previousAnalysis);

    // 选择合适的LLM模型
    const llmModel = LLM_MODELS[options.llmModel] || LLM_MODELS.default;

    // 调用LLM进行优化 - 使用REST API
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: llmModel,
        input: {
          prompt: optimizationPrompt,
          max_tokens: 2048,
          temperature: 0.3
        }
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ API调用失败:', createResponse.status, errorText);
      throw new Error(`API调用失败: ${createResponse.status} - ${errorText}`);
    }

    const prediction = await createResponse.json();
    
    // 轮询获取结果
    const result = await pollPrediction(prediction.id, process.env.REPLICATE_API_TOKEN);
    const response = Array.isArray(result.output) ? result.output.join('') : result.output;
    const parsedResult = parseOptimizationResult(response, prompt, targetModel);

    console.log('✅ 优化完成:', parsedResult);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsedResult)
    };

  } catch (error) {
    console.error('❌ 优化失败:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: `优化服务失败: ${error.message}`,
        details: error.stack
      })
    };
  }
};

/**
 * 构建针对LLM的优化提示词 - 集成分析结果
 */
function buildOptimizationPrompt(userPrompt, targetModel, options, previousAnalysis) {
  const { style = 'balanced', focus = 'quality', language = 'en' } = options; // 🔥 默认使用英文
  
  // 🔥 新语言策略：默认英文，可选中英混合
  const shouldUseChinese = language === 'zh';
  const shouldUseEnglish = language === 'en' || language === 'auto'; // auto默认为英文
  
  console.log('🌐 语言设置:', { language, shouldUseChinese, shouldUseEnglish });

  // 🔥 构建基于分析结果的上下文信息
  let analysisContext = '';
  if (previousAnalysis) {
    analysisContext = `

**之前的分析结果**：
- 综合评分：${previousAnalysis.overall}/100
- 优势：${previousAnalysis.strengths.join(', ')}
- 不足：${previousAnalysis.weaknesses.join(', ')}
- 缺失元素：${previousAnalysis.missingElements.join(', ')}
- 改进建议：
${previousAnalysis.suggestions.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

**基于分析结果的针对性优化要求**：
${buildTargetedRequirements(previousAnalysis)}`;
  }

  // 🌐 根据语言设置构建不同的提示词模板
  if (shouldUseChinese) {
    return buildChineseOptimizationPrompt(userPrompt, targetModel, options, previousAnalysis, analysisContext);
  } else {
    return buildEnglishOptimizationPrompt(userPrompt, targetModel, options, previousAnalysis, analysisContext);
  }
}

/**
 * 🔥 新增：基于分析结果构建针对性要求
 */
function buildTargetedRequirements(analysis) {
  const requirements = [];
  
  // 根据缺失元素生成针对性要求
  if (analysis.missingElements.includes('艺术风格')) {
    requirements.push('- 必须添加明确的艺术风格描述（如photorealistic, cinematic photography等）');
  }
  if (analysis.missingElements.includes('情绪氛围')) {
    requirements.push('- 必须补充情绪氛围标签（如warm lighting, epic dramatic等）');
  }
  if (analysis.missingElements.includes('技术参数')) {
    requirements.push('- 必须加入技术参数描述（如85mm lens, golden hour lighting等）');
  }
  
  // 根据评分低的维度生成要求
  if (analysis.specificity < 70) {
    requirements.push('- 增加具体细节描述，避免抽象表达');
  }
  if (analysis.technical < 70) {
    requirements.push('- 强化技术参数和质量增强词汇');
  }
  if (analysis.clarity < 70) {
    requirements.push('- 优化表达清晰度，避免模糊描述');
  }
  
  return requirements.length > 0 ? requirements.join('\n') : '- 在保持原意基础上全面提升质量';
}

/**
 * 获取模型特性描述
 */
function getModelCharacteristics(targetModel, language = 'zh') {
  const characteristics = {
    'flux-schnell': {
      zh: '超快4步生成模型，擅长快速生成，适合简洁明确的提示词，避免过度复杂的描述',
      en: 'Ultra-fast 4-step generation model, excels at quick generation, suitable for concise and clear prompts, avoid overly complex descriptions'
    },
    'imagen-4-ultra': {
      zh: 'Google高质量模型，擅长真实感图像，支持详细的自然语言描述，对光影效果理解出色',  
      en: 'Google high-quality model, excels at photorealistic images, supports detailed natural language descriptions, excellent understanding of lighting effects'
    },
    'sdxl-lightning-4step': {
      zh: 'ByteDance闪电模型，平衡速度和质量，适合艺术风格和创意表达',
      en: 'ByteDance lightning model, balances speed and quality, suitable for artistic styles and creative expression'
    },
    'stable-diffusion': {
      zh: '经典SDXL模型，成熟稳定，支持丰富的风格词汇，适合添加负面提示词',
      en: 'Classic SDXL model, mature and stable, supports rich style vocabulary, suitable for negative prompts'
    }
  };

  const modelChar = characteristics[targetModel];
  if (!modelChar) {
    return language === 'zh' ? '通用AI图像生成模型，支持多种风格和主题' : 'Universal AI image generation model, supports various styles and themes';
  }
  
  return modelChar[language] || modelChar.zh;
}

/**
 * 解析LLM返回的优化结果
 */
function parseOptimizationResult(llmResponse, originalPrompt, targetModel) {
  try {
    // 尝试从响应中提取JSON
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      throw new Error('LLM响应中未找到JSON格式的优化结果');
    }

    const parsedResult = JSON.parse(jsonMatch[1]);
    
    // 验证必要字段
    if (!parsedResult.optimizedPrompt) {
      throw new Error('优化结果中缺少optimizedPrompt字段');
    }

    return {
      optimizedPrompt: parsedResult.optimizedPrompt,
      improvements: parsedResult.improvements || ['AI模型优化'],
      confidence: Math.min(Math.max(parsedResult.confidence || 80, 0), 100),
      reasoning: parsedResult.reasoning || '基于模型特性进行优化',
      suggestedTags: parsedResult.suggestedTags || {},
      modelSpecificTips: parsedResult.modelSpecificTips || {}
    };

  } catch (error) {
    console.error('❌ 解析LLM优化结果失败:', error);
    throw new Error(`解析优化结果失败: ${error.message}`);
  }
}

// 轮询Replicate预测结果
async function pollPrediction(predictionId, apiToken) {
  const maxAttempts = 30; // 最多等待2.5分钟
  const pollInterval = 5000; // 5秒轮询一次

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`轮询失败: ${response.status}`);
      }

      const prediction = await response.json();
      console.log(`🔄 轮询 ${attempt}/${maxAttempts}, 状态: ${prediction.status}`);

      if (prediction.status === 'succeeded') {
        return prediction;
      }

      if (prediction.status === 'failed') {
        throw new Error(`优化失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('优化被取消');
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(`⚠️ 轮询出错，重试中... ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error('优化超时，请重试');
}

/**
 * 🇨🇳 构建中文优化提示词模板
 */
function buildChineseOptimizationPrompt(userPrompt, targetModel, options, previousAnalysis, analysisContext) {
  const { style = 'balanced', focus = 'quality' } = options;
  
  return `你是专业的AI图像生成提示词优化专家。请基于已有的分析结果优化以下提示词，使其在 ${targetModel} 模型上产生更好效果。

**原始提示词**：
"${userPrompt}"

**目标模型**：${targetModel}
${getModelCharacteristics(targetModel, 'zh')}${analysisContext}

**优化要求**：
- 优化风格：${style}
- 优化重点：${focus}
- 🎯 **重要**：用户输入了中文提示词，请提供**双语优化方案**
- 保持原意，增强细节描述
- 避免重复内容
${previousAnalysis ? '- 重点解决分析中发现的不足问题' : ''}

**语言策略说明**：
- AI图像生成模型对英文关键词理解更准确
- 但中文用户更容易理解和修改中文提示词
- 建议采用："中文核心描述 + 英文专业标签"的混合方式

**预定义专业标签**（英文，按需选择）：
- 艺术风格：photorealistic, cinematic photography, oil painting, anime style, concept art, professional photography
- 情绪氛围：warm lighting, dark mysterious, dreamy ethereal, epic dramatic, wild primal, cozy warm  
- 技术参数：85mm lens, macro photography, golden hour lighting, studio lighting, shallow depth of field
- 效果增强：highly detailed, masterpiece, volumetric lighting, professional quality, ultra high resolution

**请按以下JSON格式返回**：
\`\`\`json
{
  "optimizedPrompt": "优化后的提示词（中文描述+英文专业标签的混合形式，如：美丽的女性肖像, professional portrait photography, soft lighting, 85mm lens）",
  "improvements": [
    "具体改进点1：说明如何解决分析中的问题",
    "具体改进点2：解释混合语言的优势"
  ],
  "confidence": 85,
  "reasoning": "优化思路说明，重点说明为什么采用中英文混合方式",
  "suggestedTags": {
    "artStyle": "选择最合适的艺术风格（英文标签）",
    "mood": "选择最合适的情绪氛围（英文标签）", 
    "technical": ["合适的技术参数（英文标签）"],
    "enhancement": ["合适的增强词汇（英文标签）"]
  }
}
\`\`\`

**重要**：
1. 优化后的提示词应该是"中文核心描述 + 英文专业标签"的形式
2. 保持用户的中文创意表达，同时添加英文技术词汇
3. 在reasoning中解释混合语言的优势
4. 返回有效JSON格式`;
}

/**
 * 🇺🇸 构建英文优化提示词模板  
 */
function buildEnglishOptimizationPrompt(userPrompt, targetModel, options, previousAnalysis, analysisContext) {
  const { style = 'balanced', focus = 'quality' } = options;
  
  return `You are a professional AI image generation prompt optimization expert. Please optimize the following prompt based on the analysis results to achieve better results on ${targetModel}.

**Original Prompt**:
"${userPrompt}"

**Target Model**: ${targetModel}
${getModelCharacteristics(targetModel, 'en')}${analysisContext}

**Optimization Requirements**:
- Style: ${style}
- Focus: ${focus}
- Maintain original intent while enhancing details
- Avoid repetitive content
${previousAnalysis ? '- Focus on solving issues found in the analysis' : ''}

**Predefined Professional Tags** (select as needed):
- Art Styles: photorealistic, cinematic photography, oil painting, anime style, concept art, professional photography
- Mood/Atmosphere: warm lighting, dark mysterious, dreamy ethereal, epic dramatic, wild primal, cozy warm
- Technical: 85mm lens, macro photography, golden hour lighting, studio lighting, shallow depth of field
- Enhancement: highly detailed, masterpiece, volumetric lighting, professional quality, ultra high resolution

**Return in JSON format**:
\`\`\`json
{
  "optimizedPrompt": "Complete optimized prompt addressing analysis issues",
  "improvements": [
    "Specific improvement 1 explaining how analysis issues were addressed",
    "Specific improvement 2"
  ],
  "confidence": 85,
  "reasoning": "Optimization approach explanation focusing on analysis-based improvements",
  "suggestedTags": {
    "artStyle": "Most suitable art style based on analysis",
    "mood": "Most suitable mood/atmosphere based on analysis", 
    "technical": ["Suitable technical parameters based on analysis"],
    "enhancement": ["Suitable enhancement keywords based on analysis"]
  }
}
\`\`\`

**Important**:
1. Prioritize solving specific issues found in the analysis
2. Select the most suitable tags based on analysis suggestions, not generic ones
3. Clearly explain in improvements how analysis results were addressed
4. Maintain original creative intent while focusing on quality enhancement
5. Return valid JSON format`;
} 