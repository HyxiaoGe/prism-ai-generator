/**
 * 实时提示词建议服务
 * 根据用户输入提供智能补全和建议
 */

// 直接使用REST API，不依赖replicate库

// 预设的建议模板（作为降级方案）
const SUGGESTION_TEMPLATES = {
  // 人物相关
  'portrait': [
    'professional portrait photography, soft lighting',
    'headshot, studio lighting, shallow depth of field',
    'editorial portrait, dramatic lighting, high fashion'
  ],
  'person': [
    'full body portrait, elegant pose',
    'candid street photography style',
    'professional model photography'
  ],
  
  // 风景相关
  'landscape': [
    'breathtaking mountain landscape, golden hour',
    'serene forest scene, misty morning',
    'dramatic ocean waves, sunset lighting'
  ],
  'nature': [
    'pristine wilderness, natural lighting',
    'botanical garden, macro photography',
    'wildlife photography, telephoto lens'
  ],
  
  // 建筑相关
  'building': [
    'modern architecture, geometric composition',
    'historic building, architectural photography',
    'urban skyline, blue hour lighting'
  ],
  'city': [
    'bustling cityscape, neon lights',
    'urban street photography, candid moments',
    'metropolitan architecture, high angle view'
  ],
  
  // 艺术风格
  'painting': [
    'oil painting style, classical brushwork',
    'watercolor technique, soft flowing colors',
    'digital painting, concept art style'
  ],
  'art': [
    'fine art photography, museum quality',
    'artistic composition, creative lighting',
    'contemporary art style, bold colors'
  ],
  
  // 科技相关
  'robot': [
    'futuristic android, sleek metallic design',
    'advanced robotics, LED lighting accents',
    'cybernetic enhancement, high-tech details'
  ],
  'sci-fi': [
    'science fiction scene, futuristic technology',
    'space exploration, cosmic background',
    'cyberpunk aesthetic, neon atmosphere'
  ]
};

// 质量增强建议
const QUALITY_SUGGESTIONS = [
  'high quality, detailed, 8K resolution',
  'professional photography, award-winning',
  'masterpiece, best quality, ultra-detailed',
  'cinematic lighting, dramatic composition',
  'hyperrealistic, photorealistic quality'
];

// 技术参数建议
const TECHNICAL_SUGGESTIONS = [
  '85mm lens, shallow depth of field',
  'wide-angle lens, environmental context',
  'macro photography, intricate details',
  'studio lighting, professional setup',
  'golden hour lighting, warm atmosphere'
];

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      partialPrompt, 
      context: userContext = {},
      maxSuggestions = 5 
    } = JSON.parse(event.body);

    console.log('💡 生成提示词建议:', { partialPrompt, userContext });

    // 如果提示词太短，使用基础建议
    if (!partialPrompt || partialPrompt.trim().length < 3) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          suggestions: getBasicSuggestions(maxSuggestions)
        })
      };
    }

    // 尝试使用LLM生成智能建议
    try {
      const suggestions = await generateAISuggestions(partialPrompt, userContext, maxSuggestions);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ suggestions })
      };

    } catch (llmError) {
      console.log('⚠️ LLM建议生成失败，使用规则建议:', llmError.message);
      
      // 降级到规则建议
      const fallbackSuggestions = generateRuleBasedSuggestions(partialPrompt, maxSuggestions);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ suggestions: fallbackSuggestions })
      };
    }

  } catch (error) {
    console.error('❌ 建议生成失败:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '建议服务暂时不可用',
        suggestions: getBasicSuggestions(3)
      })
    };
  }
};

/**
 * 使用LLM生成智能建议
 */
async function generateAISuggestions(partialPrompt, userContext, maxSuggestions) {
  const suggestionPrompt = buildSuggestionPrompt(partialPrompt, userContext, maxSuggestions);
  
  // 使用REST API调用Llama模型
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'meta/meta-llama-3.1-8b-instruct',
      input: {
        prompt: suggestionPrompt,
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.9
      }
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`API调用失败: ${createResponse.status}`);
  }

  const prediction = await createResponse.json();
  
  // 轮询获取结果
  const result = await pollPrediction(prediction.id, process.env.REPLICATE_API_TOKEN);
  const response = Array.isArray(result.output) ? result.output.join('') : result.output;
  return parseAISuggestions(response, maxSuggestions);
}

/**
 * 构建LLM建议提示词
 */
function buildSuggestionPrompt(partialPrompt, userContext, maxSuggestions) {
  const { selectedTags = {}, targetModel = '', recentHistory = [] } = userContext;

  return `你是一个专业的AI图像生成提示词助手。用户正在输入一个提示词，请根据他们的部分输入提供${maxSuggestions}个有用的补全建议。

**用户当前输入**：
"${partialPrompt}"

**上下文信息**：
- 目标模型：${targetModel}
- 已选标签：${JSON.stringify(selectedTags)}
- 最近历史：${recentHistory.slice(0, 3).join('; ')}

**要求**：
1. 基于用户输入的主题和风格继续补全
2. 保持与已输入内容的连贯性
3. 添加有助于提升图像质量的描述
4. 每个建议应该是完整的、可直接使用的

**请按以下格式返回**：
1. [第一个建议]
2. [第二个建议]  
3. [第三个建议]
4. [第四个建议]
5. [第五个建议]

**示例**：
用户输入："beautiful woman"
建议：
1. beautiful woman, professional portrait photography, soft studio lighting, elegant pose
2. beautiful woman with flowing hair, golden hour lighting, cinematic composition, dreamy atmosphere
3. beautiful woman in elegant dress, high fashion photography, dramatic lighting, luxury setting

现在请为用户输入"${partialPrompt}"提供建议：`;
}

/**
 * 解析LLM建议结果
 */
function parseAISuggestions(llmResponse, maxSuggestions) {
  try {
    const lines = llmResponse.split('\n').filter(line => line.trim());
    const suggestions = [];

    for (const line of lines) {
      // 匹配编号格式：1. suggestion 或者 - suggestion
      const match = line.match(/^\d+\.\s*(.+)$/) || line.match(/^-\s*(.+)$/);
      if (match && match[1]) {
        suggestions.push(match[1].trim());
        if (suggestions.length >= maxSuggestions) break;
      }
    }

    // 如果没有解析到足够的建议，补充一些
    if (suggestions.length < maxSuggestions) {
      const additional = generateRuleBasedSuggestions('', maxSuggestions - suggestions.length);
      suggestions.push(...additional);
    }

    return suggestions.slice(0, maxSuggestions);

  } catch (error) {
    console.error('❌ 解析LLM建议失败:', error);
    return generateRuleBasedSuggestions('', maxSuggestions);
  }
}

/**
 * 基于规则的建议生成（降级方案）
 */
function generateRuleBasedSuggestions(partialPrompt, maxSuggestions) {
  const suggestions = [];
  const keywords = partialPrompt.toLowerCase();

  // 根据关键词匹配相应的建议模板
  for (const [key, templates] of Object.entries(SUGGESTION_TEMPLATES)) {
    if (keywords.includes(key) || keywords.includes(key.slice(0, -1))) {
      suggestions.push(...templates);
      if (suggestions.length >= maxSuggestions) break;
    }
  }

  // 如果没有匹配到，添加通用建议
  if (suggestions.length === 0) {
    if (keywords.includes('人') || keywords.includes('woman') || keywords.includes('man')) {
      suggestions.push(...SUGGESTION_TEMPLATES.portrait);
    } else if (keywords.includes('风景') || keywords.includes('landscape')) {
      suggestions.push(...SUGGESTION_TEMPLATES.landscape);
    } else {
      // 通用质量增强建议
      suggestions.push(...QUALITY_SUGGESTIONS.slice(0, 3));
      suggestions.push(...TECHNICAL_SUGGESTIONS.slice(0, 2));
    }
  }

  // 确保每个建议都包含原始输入
  const enhancedSuggestions = suggestions.map(suggestion => {
    if (partialPrompt.trim() && !suggestion.toLowerCase().includes(partialPrompt.toLowerCase())) {
      return `${partialPrompt.trim()}, ${suggestion}`;
    }
    return suggestion;
  });

  return enhancedSuggestions.slice(0, maxSuggestions);
}

/**
 * 获取基础建议（当输入为空时）
 */
function getBasicSuggestions(maxSuggestions) {
  const basic = [
    '美丽的女性肖像, 专业摄影, 柔和光线',
    '壮丽的山脉风景, 黄金时刻, 戏剧性天空',
    '未来主义城市, 霓虹灯光, 赛博朋克风格',
    '可爱的小动物, 自然光线, 高清细节',
    '抽象艺术作品, 鲜艳色彩, 现代风格'
  ];

  return basic.slice(0, maxSuggestions);
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
        throw new Error(`建议生成失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('建议生成被取消');
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

  throw new Error('建议生成超时，请重试');
} 