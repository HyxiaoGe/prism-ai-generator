const LLM_MODELS = {
  'claude-3-haiku': 'meta/meta-llama-3.1-8b-instruct',
  'default': 'deepseek-ai/deepseek-v3'
};

/**
 * 翻译英文提示词为中文
 */
exports.handler = async (event, context) => {
  // 🔧 确保函数不会提前结束
  context.callbackWaitsForEmptyEventLoop = false;

  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '仅支持POST请求' })
    };
  }

  try {
    const { englishPrompt } = JSON.parse(event.body);

    if (!englishPrompt || typeof englishPrompt !== 'string' || !englishPrompt.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '英文提示词不能为空' })
      };
    }

    console.log('🌐 开始翻译英文提示词:', englishPrompt);

    // 构建翻译提示词
    const translationPrompt = buildTranslationPrompt(englishPrompt);
    const llmModel = LLM_MODELS.default;

    // 调用Replicate API
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: llmModel,
        input: {
          prompt: translationPrompt,
          max_tokens: 1024,
          temperature: 0.2
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
    const translationResult = parseTranslationResult(response, englishPrompt);

    console.log('✅ 翻译完成:', translationResult);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(translationResult)
    };

  } catch (error) {
    console.error('❌ 翻译失败:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `翻译服务失败: ${error.message}`,
        details: error.stack
      })
    };
  }
};

/**
 * 构建翻译提示词
 */
function buildTranslationPrompt(englishPrompt) {
  return `你是专业的AI图像生成提示词翻译专家。请将以下英文提示词翻译成自然流畅的中文，保持原意和艺术表达。

**翻译要求**：
1. 保持原始的创意意图和情绪表达
2. 技术术语可以保留英文或提供中英对照
3. 翻译要自然流畅，便于中文用户理解
4. 保持艺术性和专业性

**英文提示词**：
"${englishPrompt}"

**请按以下JSON格式返回翻译结果**：
\`\`\`json
{
  "chineseTranslation": "翻译后的完整中文提示词",
  "explanation": "简要说明翻译思路和重点",
  "keyTerms": [
    {
      "english": "关键英文术语1",
      "chinese": "对应中文解释1"
    },
    {
      "english": "关键英文术语2", 
      "chinese": "对应中文解释2"
    }
  ]
}
\`\`\`

**注意**：
- 确保翻译准确传达原始创意意图
- 对于专业摄影和艺术术语，提供恰当的中文表达
- 保持自然的中文表达习惯
- 返回标准JSON格式`;
}

/**
 * 解析翻译结果
 */
function parseTranslationResult(llmResponse, originalPrompt) {
  try {
    // 尝试从响应中提取JSON
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      throw new Error('LLM响应中未找到JSON格式的翻译结果');
    }

    const parsedResult = JSON.parse(jsonMatch[1]);
    
    // 验证必要字段
    if (!parsedResult.chineseTranslation) {
      throw new Error('翻译结果中缺少chineseTranslation字段');
    }

    return {
      originalPrompt: originalPrompt,
      chineseTranslation: parsedResult.chineseTranslation,
      explanation: parsedResult.explanation || '智能翻译完成',
      keyTerms: parsedResult.keyTerms || [],
      confidence: 95 // 翻译置信度
    };

  } catch (error) {
    console.error('❌ 解析翻译结果失败:', error);
    
    // 降级处理：返回简单翻译
    return {
      originalPrompt: originalPrompt,
      chineseTranslation: `[翻译] ${originalPrompt}`,
      explanation: '翻译服务暂时不可用，显示原文',
      keyTerms: [],
      confidence: 0
    };
  }
}

/**
 * 轮询预测结果
 */
async function pollPrediction(predictionId, apiToken) {
  const maxAttempts = 25; // 减少尝试次数，适配60秒超时
  const delay = 2000;
  const startTime = Date.now();
  const maxWaitTime = 55000; // 55秒超时保护

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 检查超时
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error('翻译超时，请重试');
    }

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`轮询请求失败: ${response.status}`);
    }

    const prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      return prediction;
    } else if (prediction.status === 'failed') {
      throw new Error(`翻译失败: ${prediction.error}`);
    }

    // 等待后再次轮询
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('翻译超时，请重试');
} 