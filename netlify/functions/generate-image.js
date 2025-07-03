exports.handler = async (event, context) => {
  // 处理CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { prompt, model = 'flux-schnell', aspectRatio = '1:1', numInferenceSteps = 4, outputFormat = 'webp', numOutputs = 4 } = JSON.parse(event.body);
    
    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: '缺少必需的prompt参数' }),
      };
    }

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    
    if (!REPLICATE_API_TOKEN) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Replicate API配置错误' }),
      };
    }

    console.log('🎨 开始生成图像, prompt:', prompt, 'model:', model);

    // 调用Replicate API
    const result = await generateWithReplicate({
      prompt,
      model,
      aspectRatio,
      numInferenceSteps,
      outputFormat,
      numOutputs
    }, REPLICATE_API_TOKEN);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };

  } catch (error) {
    console.error('❌ 生成失败:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

// 支持的模型配置
const SUPPORTED_MODELS = {
  'flux-schnell': {
    version: 'black-forest-labs/flux-schnell',
    defaultSteps: 4,
    maxSteps: 8,
    supportsAspectRatio: true,
    supportedFormats: ['webp', 'jpg', 'png'],
    numOutputs: 4,
  },
  'imagen-4-ultra': {
    version: 'google/imagen-4-ultra',
    defaultSteps: 28,
    maxSteps: 50,
    supportsAspectRatio: true,
    supportedFormats: ['jpg', 'png'],
    numOutputs: 1,
  },
  'sdxl-lightning-4step': {
    version: 'bytedance/sdxl-lightning-4step:6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe',
    defaultSteps: 4,
    maxSteps: 8,
    supportsAspectRatio: false, // SDXL Lightning使用固定尺寸
    supportedFormats: ['webp', 'jpg', 'png'],
    numOutputs: 4,
  },
  'stable-diffusion': {
    version: 'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
    defaultSteps: 20,
    maxSteps: 50,
    supportsAspectRatio: false,
    supportedFormats: ['webp', 'jpg', 'png'],
    numOutputs: 4,
  }
};

async function generateWithReplicate(config, apiToken) {
  const { prompt, model, aspectRatio, numInferenceSteps, outputFormat, numOutputs } = config;
  
  const modelConfig = SUPPORTED_MODELS[model];
  if (!modelConfig) {
    throw new Error(`不支持的模型: ${model}`);
  }

  try {
    // 第一步：创建预测
    console.log('📤 创建Replicate预测...', { model: modelConfig.version, aspectRatio, steps: numInferenceSteps });
    
    // 根据不同模型构建输入参数
    const input = buildModelInput({
      prompt,
      model,
      aspectRatio,
      numInferenceSteps,
      outputFormat,
      numOutputs,
      modelConfig
    });

    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: modelConfig.version,
        input: input
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`创建预测失败: ${createResponse.status} ${errorText}`);
    }

    const prediction = await createResponse.json();
    console.log('✅ 预测已创建:', prediction.id);

    // 第二步：轮询获取结果
    console.log('⏳ 等待生成完成...');
    const result = await pollPrediction(prediction.id, apiToken);
    
    console.log('🎉 生成成功!');
    return {
      status: 'succeeded',
      output: result.output || [],
      input: { prompt, model, aspectRatio, numInferenceSteps, outputFormat, numOutputs }
    };

  } catch (error) {
    console.error('💥 Replicate调用失败:', error);
    throw error;
  }
}

// 根据不同模型构建输入参数
function buildModelInput({ prompt, model, aspectRatio, numInferenceSteps, outputFormat, numOutputs, modelConfig }) {
  const baseInput = {
    prompt: prompt,
    num_outputs: numOutputs,
    output_format: outputFormat,
    num_inference_steps: Math.min(numInferenceSteps, modelConfig.maxSteps),
  };

  // 针对不同模型的特殊配置
  switch (model) {
    case 'flux-schnell':
    case 'flux-dev':
    case 'imagen-4-ultra':
      return {
        ...baseInput,
        aspect_ratio: aspectRatio,
      };
    
    case 'sdxl-lightning-4step':
      return {
        prompt: prompt,
        width: 1024,
        height: 1024,
        scheduler: "K_EULER",
        num_outputs: numOutputs,
        guidance_scale: 0,
        negative_prompt: "worst quality, low quality",
        num_inference_steps: Math.min(numInferenceSteps, modelConfig.maxSteps),
        seed: Math.floor(Math.random() * 1000000), // 随机种子
      };
    
    case 'stable-diffusion':
      return {
        prompt: prompt,
        width: 1024,
        height: 1024,
        num_outputs: numOutputs,
        output_format: outputFormat,
        num_inference_steps: Math.min(numInferenceSteps, modelConfig.maxSteps),
        guidance_scale: 7.5,
        scheduler: "K_EULER",
      };
    
    default:
      return baseInput;
  }
}

async function pollPrediction(predictionId, apiToken) {
  const maxAttempts = 60; // 最多等待5分钟
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
        throw new Error(`生成失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('生成被取消');
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

  throw new Error('生成超时，请重试');
}