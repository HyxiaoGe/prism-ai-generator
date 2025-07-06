/**
 * 提示词质量分析服务
 * 实时分析提示词的各项指标并提供改进建议
 */

// 直接使用REST API，不依赖replicate库

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    console.log('🔍 开始提示词分析:', prompt);

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '提示词不能为空' })
      };
    }

    // 使用LLM进行深度分析
    const analysisPrompt = buildAnalysisPrompt(prompt);
    
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'deepseek-ai/deepseek-v3',
        input: {
          prompt: analysisPrompt,
          max_tokens: 1024,
          temperature: 0.1
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
    const analysis = parseAnalysisResult(response, prompt);

    console.log('✅ 分析完成:', analysis);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(analysis)
    };

  } catch (error) {
    console.error('❌ 分析服务错误:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: `分析服务失败: ${error.message}`,
        details: error.stack
      })
    };
  }
};

/**
 * 构建LLM分析提示词
 */
function buildAnalysisPrompt(userPrompt) {
  return `你是一个专业的AI图像生成提示词分析专家。请分析以下提示词的质量和有效性。

**待分析的提示词**：
"${userPrompt}"

**我们的图像生成系统支持的标签类别**：
- **艺术风格**：photorealistic, cinematic photography, oil painting, anime style, concept art, professional photography
- **情绪氛围**：warm lighting, dark mysterious, dreamy ethereal, epic dramatic, wild primal, cozy warm
- **技术参数**：85mm lens, macro photography, golden hour lighting, studio lighting, shallow depth of field
- **效果增强**：highly detailed, masterpiece, volumetric lighting, professional quality, ultra high resolution

**分析维度**：
1. **清晰度** (0-100): 描述是否明确、无歧义
2. **具体性** (0-100): 是否包含足够的细节信息  
3. **创意性** (0-100): 是否有独特或有趣的元素
4. **技术完整性** (0-100): 是否包含适当的技术参数和质量词汇（基于上述支持的标签）
5. **结构合理性** (0-100): 信息组织是否合理，是否存在重复标签

**请按以下JSON格式返回分析结果**：
\`\`\`json
{
  "clarity": 85,
  "specificity": 70,
  "creativity": 90,
  "technical": 60,
  "overall": 76,
  "strengths": [
    "具体的优势点1",
    "具体的优势点2"
  ],
  "weaknesses": [
    "具体的不足点1", 
    "具体的不足点2"
  ],
  "suggestions": [
    "改进建议1：具体的改进方法",
    "改进建议2：具体的改进方法"
  ],
  "missingElements": [
    "缺失的重要元素1",
    "缺失的重要元素2"
  ]
}
\`\`\`

**评分标准**：
- **清晰度**：描述是否明确、无歧义
- **具体性**：是否包含足够的细节信息，避免过于抽象
- **创意性**：是否有独特或有趣的元素，避免通用化描述
- **技术完整性**：是否使用了上述支持的标签，是否有重复标签
- **结构合理性**：信息组织是否合理，标签使用是否得当

**综合评分**：
- 90-100: 优秀，几乎完美
- 80-89: 良好，有小幅改进空间
- 70-79: 中等，需要明显改进
- 60-69: 较差，需要大幅优化
- 0-59: 很差，需要重新构思

**改进建议要求**：
- 建议应该基于我们支持的标签类别
- 如果发现重复标签，建议去除重复项
- 如果缺少重要标签，建议从上述支持的标签中选择
- 避免建议我们系统不支持的标签

请确保返回有效的JSON格式，评分要客观准确。`;
}

/**
 * 解析LLM分析结果
 */
function parseAnalysisResult(llmResponse, originalPrompt) {
  try {
    // 提取JSON部分
    const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      throw new Error('LLM响应中未找到JSON格式的分析结果');
    }

    const parsed = JSON.parse(jsonMatch[1]);
    
    // 验证和规范化数据
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
    console.error('❌ 解析LLM分析结果失败:', error);
    throw new Error(`解析分析结果失败: ${error.message}`);
  }
}

// 轮询Replicate预测结果
async function pollPrediction(predictionId, apiToken) {
  const maxAttempts = 30; // 最多等待2.5分钟 (LLM通常比图像生成快)
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
        throw new Error(`分析失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('分析被取消');
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

  throw new Error('分析超时，请重试');
} 