/**
 * 智能模板生成服务
 * 基于主题和风格生成最佳实践模板
 */

// 直接使用REST API，不依赖replicate库

// 预设的模板库（作为降级方案和参考）
const TEMPLATE_LIBRARY = {
  // 人像摄影模板
  portrait: {
    professional: {
      template: "professional portrait photography of a {subject}, studio lighting, 85mm lens, shallow depth of field, elegant pose, high quality, detailed",
      explanation: "专业人像摄影，使用工作室灯光和85mm镜头营造浅景深效果",
      examples: [
        "professional portrait photography of a business executive, studio lighting, 85mm lens, shallow depth of field, elegant pose, high quality, detailed",
        "professional portrait photography of a young artist, studio lighting, 85mm lens, shallow depth of field, elegant pose, high quality, detailed"
      ],
      tags: { artStyle: '摄影级逼真', mood: '专业商务', technical: ['85mm镜头', '工作室灯光'] }
    },
    casual: {
      template: "candid portrait of a {subject}, natural lighting, 50mm lens, relaxed atmosphere, lifestyle photography, authentic moment",
      explanation: "生活化人像，强调自然光线和真实情感表达",
      examples: [
        "candid portrait of a coffee shop owner, natural lighting, 50mm lens, relaxed atmosphere, lifestyle photography, authentic moment",
        "candid portrait of a street musician, natural lighting, 50mm lens, relaxed atmosphere, lifestyle photography, authentic moment"
      ],
      tags: { artStyle: '纪实摄影', mood: '轻松自然', technical: ['自然光线'] }
    }
  },

  // 风景摄影模板
  landscape: {
    dramatic: {
      template: "epic {subject} landscape, dramatic sky, golden hour lighting, wide-angle lens, sweeping vista, cinematic composition, 4K quality",
      explanation: "史诗级风景摄影，强调戏剧性天空和电影级构图",
      examples: [
        "epic mountain landscape, dramatic sky, golden hour lighting, wide-angle lens, sweeping vista, cinematic composition, 4K quality",
        "epic ocean landscape, dramatic sky, golden hour lighting, wide-angle lens, sweeping vista, cinematic composition, 4K quality"
      ],
      tags: { artStyle: '电影级画质', mood: '震撼史诗', technical: ['广角镜头', '黄金时刻'] }
    },
    serene: {
      template: "peaceful {subject} scene, soft morning light, misty atmosphere, calm composition, zen-like tranquility, high detail",
      explanation: "宁静风景摄影，强调晨光和禅意氛围",
      examples: [
        "peaceful forest scene, soft morning light, misty atmosphere, calm composition, zen-like tranquility, high detail",
        "peaceful lake scene, soft morning light, misty atmosphere, calm composition, zen-like tranquility, high detail"
      ],
      tags: { artStyle: '自然摄影', mood: '宁静平和', technical: ['晨光摄影'] }
    }
  },

  // 艺术创作模板
  art: {
    painting: {
      template: "{subject} in classical oil painting style, rich brushwork, museum quality, artistic masterpiece, detailed texture, traditional techniques",
      explanation: "古典油画风格，强调传统绘画技法和丰富的笔触质感",
      examples: [
        "portrait in classical oil painting style, rich brushwork, museum quality, artistic masterpiece, detailed texture, traditional techniques",
        "still life in classical oil painting style, rich brushwork, museum quality, artistic masterpiece, detailed texture, traditional techniques"
      ],
      tags: { artStyle: '油画风格', mood: '古典优雅', enhancement: ['艺术大师'] }
    },
    digital: {
      template: "digital art of {subject}, concept art style, vibrant colors, detailed illustration, fantasy elements, high resolution artwork",
      explanation: "数字艺术风格，适合概念艺术和幻想主题创作",
      examples: [
        "digital art of futuristic city, concept art style, vibrant colors, detailed illustration, fantasy elements, high resolution artwork",
        "digital art of mystical creature, concept art style, vibrant colors, detailed illustration, fantasy elements, high resolution artwork"
      ],
      tags: { artStyle: '概念艺术', mood: '奇幻创意', enhancement: ['高分辨率'] }
    }
  },

  // 科幻主题模板
  'sci-fi': {
    cyberpunk: {
      template: "cyberpunk {subject}, neon lights, futuristic cityscape, rain-soaked streets, atmospheric lighting, high-tech dystopian, cinematic style",
      explanation: "赛博朋克风格，强调霓虹灯光和反乌托邦氛围",
      examples: [
        "cyberpunk street scene, neon lights, futuristic cityscape, rain-soaked streets, atmospheric lighting, high-tech dystopian, cinematic style",
        "cyberpunk character, neon lights, futuristic cityscape, rain-soaked streets, atmospheric lighting, high-tech dystopian, cinematic style"
      ],
      tags: { themeStyle: '赛博朋克', mood: '未来科技', technical: ['电影感'] }
    },
    spaceship: {
      template: "futuristic {subject}, sleek spaceship design, advanced technology, holographic displays, cosmic background, science fiction aesthetic",
      explanation: "未来科技风格，适合太空和科技主题",
      examples: [
        "futuristic spacecraft interior, sleek spaceship design, advanced technology, holographic displays, cosmic background, science fiction aesthetic",
        "futuristic robot, sleek spaceship design, advanced technology, holographic displays, cosmic background, science fiction aesthetic"
      ],
      tags: { themeStyle: '科幻场景', mood: '未来科技', enhancement: ['高科技'] }
    }
  }
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
      theme, 
      style, 
      options = {},
      successCases = []
    } = JSON.parse(event.body);

    console.log('📋 生成模板:', { theme, style, options });

    // 尝试使用LLM生成智能模板
    try {
      const template = await generateAITemplate(theme, style, options, successCases);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(template)
      };

    } catch (llmError) {
      console.log('⚠️ LLM模板生成失败，使用预设模板:', llmError.message);
      
      // 降级到预设模板
      const fallbackTemplate = getFallbackTemplate(theme, style, options);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(fallbackTemplate)
      };
    }

  } catch (error) {
    console.error('❌ 模板生成失败:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '模板生成服务暂时不可用',
        fallback: getBasicTemplate()
      })
    };
  }
};

/**
 * 使用LLM生成智能模板
 */
async function generateAITemplate(theme, style, options, successCases) {
  const templatePrompt = buildTemplatePrompt(theme, style, options, successCases);
  
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
        prompt: templatePrompt,
        max_tokens: 1024,
        temperature: 0.3,
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
  return parseAITemplate(response, theme, style);
}

/**
 * 构建LLM模板生成提示词
 */
function buildTemplatePrompt(theme, style, options, successCases) {
  const { complexity = 'detailed', audience = 'intermediate' } = options;

  return `你是一个专业的AI图像生成提示词模板设计师。请为以下需求创建一个高质量的提示词模板。

**模板需求**：
- 主题：${theme}
- 风格：${style}
- 复杂度：${complexity}
- 目标用户：${audience}

**成功案例参考**：
${successCases.slice(0, 3).map(case => `- ${case.prompt}`).join('\n')}

**模板要求**：
1. 创建一个可重用的提示词模板
2. 使用 \\{subject\\} 作为主体占位符
3. 包含适当的技术参数和质量描述
4. 确保模板适合${style}风格的${theme}主题
5. 为${audience}级别用户设计

**请按以下JSON格式返回**：
\`\`\`json
{
  "template": "具体的提示词模板，使用\\{subject\\}作为占位符",
  "explanation": "详细解释模板的设计思路和使用方法",
  "examples": [
    "示例1：将\\{subject\\}替换为具体内容的完整提示词",
    "示例2：另一个具体应用示例",
    "示例3：第三个应用示例"
  ],
  "tags": {
    "artStyle": "推荐的艺术风格",
    "mood": "推荐的情绪氛围",
    "technical": ["技术参数1", "技术参数2"],
    "enhancement": ["增强词汇1", "增强词汇2"]
  },
  "tips": [
    "使用技巧1",
    "使用技巧2",
    "使用技巧3"
  ],
  "variations": [
    "变体模板1：针对不同应用场景的调整",
    "变体模板2：另一种风格变化"
  ]
}
\`\`\`

**模板示例**：
主题：人像，风格：专业
模板："professional portrait of a {subject}, studio lighting, 85mm lens, shallow depth of field, elegant pose, high quality, detailed"

现在请为主题"${theme}"和风格"${style}"创建模板：`;
}

/**
 * 解析LLM模板结果
 */
function parseAITemplate(llmResponse, theme, style) {
  try {
    // 提取JSON部分
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      
      // 验证必要字段
      if (!parsed.template) {
        throw new Error('Missing template field');
      }

      return {
        template: parsed.template,
        explanation: parsed.explanation || `${style}风格的${theme}主题模板`,
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        tags: parsed.tags || {},
        tips: Array.isArray(parsed.tips) ? parsed.tips : [],
        variations: Array.isArray(parsed.variations) ? parsed.variations : []
      };
    }

    throw new Error('No JSON found in LLM response');

  } catch (error) {
    console.error('❌ 解析LLM模板失败:', error);
    return getFallbackTemplate(theme, style, {});
  }
}

/**
 * 获取预设模板（降级方案）
 */
function getFallbackTemplate(theme, style, options) {
  // 尝试从模板库中匹配
  const themeTemplates = TEMPLATE_LIBRARY[theme.toLowerCase()];
  if (themeTemplates) {
    const styleTemplate = themeTemplates[style.toLowerCase()];
    if (styleTemplate) {
      return styleTemplate;
    }
  }

  // 如果没有精确匹配，返回通用模板
  return generateGenericTemplate(theme, style);
}

/**
 * 生成通用模板
 */
function generateGenericTemplate(theme, style) {
  const qualityTerms = 'high quality, detailed, professional';
  const styleTerms = getStyleTerms(style);
  const themeTerms = getThemeTerms(theme);

  const template = `${themeTerms} {subject}, ${styleTerms}, ${qualityTerms}`;

  return {
    template,
    explanation: `${style}风格的${theme}主题通用模板，适合多种应用场景`,
    examples: [
      template.replace('{subject}', '示例主体'),
      template.replace('{subject}', '另一个示例')
    ],
    tags: {
      artStyle: style,
      mood: theme,
      enhancement: ['high quality', 'detailed']
    }
  };
}

/**
 * 获取风格相关词汇
 */
function getStyleTerms(style) {
  const styleMapping = {
    'professional': 'professional photography, studio lighting',
    'artistic': 'artistic composition, creative lighting',
    'cinematic': 'cinematic style, dramatic lighting',
    'realistic': 'photorealistic, hyperrealistic',
    'painting': 'oil painting style, artistic brushwork',
    'digital': 'digital art, concept art style',
    'vintage': 'vintage style, retro aesthetic',
    'modern': 'modern design, contemporary style'
  };

  return styleMapping[style.toLowerCase()] || 'artistic style, creative composition';
}

/**
 * 获取主题相关词汇
 */
function getThemeTerms(theme) {
  const themeMapping = {
    'portrait': 'portrait photography',
    'landscape': 'landscape photography',
    'nature': 'natural scene',
    'architecture': 'architectural photography',
    'abstract': 'abstract art',
    'sci-fi': 'science fiction scene',
    'fantasy': 'fantasy artwork',
    'urban': 'urban scene',
    'minimal': 'minimalist composition'
  };

  return themeMapping[theme.toLowerCase()] || theme;
}

/**
 * 获取基础模板
 */
function getBasicTemplate() {
  return {
    template: "{subject}, high quality, detailed, professional composition",
    explanation: "通用基础模板，适合各种主题和风格",
    examples: [
      "beautiful landscape, high quality, detailed, professional composition",
      "elegant portrait, high quality, detailed, professional composition"
    ],
    tags: {
      enhancement: ['high quality', 'detailed', 'professional']
    }
  };
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
        throw new Error(`模板生成失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('模板生成被取消');
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

  throw new Error('模板生成超时，请重试');
} 