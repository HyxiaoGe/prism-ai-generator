exports.handler = async (event, context) => {
  // 🔧 确保函数不会提前结束
  context.callbackWaitsForEmptyEventLoop = false;

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
    const { prompt, model = 'flux-schnell', aspectRatio, numInferenceSteps, outputFormat, numOutputs } = JSON.parse(event.body);
    
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
    defaultAspectRatio: '1:1',
    defaultOutputFormat: 'webp',
    defaultNumOutputs: 4,
    supportsAspectRatio: true,
    supportedFormats: ['webp', 'jpg', 'png'],
  },
  'imagen-4-ultra': {
    version: 'google/imagen-4-ultra',
    defaultSteps: 28,
    maxSteps: 50,
    defaultAspectRatio: '16:9',
    defaultOutputFormat: 'jpg',
    defaultNumOutputs: 1,
    supportsAspectRatio: true,
    supportedFormats: ['jpg', 'png'],
  }
};

async function generateWithReplicate(config, apiToken) {
  const { prompt, model, aspectRatio, numInferenceSteps, outputFormat, numOutputs } = config;
  
  const modelConfig = SUPPORTED_MODELS[model];
  if (!modelConfig) {
    throw new Error(`不支持的模型: ${model}`);
  }

  // 🔧 使用模型特定的默认值
  const finalConfig = {
    prompt,
    model,
    aspectRatio: aspectRatio || modelConfig.defaultAspectRatio,
    numInferenceSteps: numInferenceSteps || modelConfig.defaultSteps,
    outputFormat: outputFormat || modelConfig.defaultOutputFormat,
    numOutputs: numOutputs || modelConfig.defaultNumOutputs
  };

  try {
    // 第一步：创建预测
    console.log('📤 创建Replicate预测...', { 
      model: modelConfig.version, 
      aspectRatio: finalConfig.aspectRatio, 
      steps: finalConfig.numInferenceSteps,
      outputs: finalConfig.numOutputs,
      format: finalConfig.outputFormat
    });
    
    // 根据不同模型构建输入参数
    const input = buildModelInput({
      prompt: finalConfig.prompt,
      model: finalConfig.model,
      aspectRatio: finalConfig.aspectRatio,
      numInferenceSteps: finalConfig.numInferenceSteps,
      outputFormat: finalConfig.outputFormat,
      numOutputs: finalConfig.numOutputs,
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
      input: finalConfig
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
    
    default:
      return baseInput;
  }
}

async function pollPrediction(predictionId, apiToken) {
  const maxAttempts = 20; // 最多等待60秒
  const pollInterval = 2500; // 2.5秒轮询一次，平衡效率和响应速度
  const startTime = Date.now();
  const maxWaitTime = 58000; // 58秒超时保护，留2秒缓冲

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 检查是否超过总时间限制
    const elapsed = Date.now() - startTime;
    if (elapsed > maxWaitTime) {
      console.error(`❌ 函数执行超时: ${Math.round(elapsed/1000)}s`);
      throw new Error(`生成超时(${Math.round(elapsed/1000)}s)，图像生成需要时间较长，请稍后重试`);
    }

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
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      console.log(`🔄 轮询 ${attempt}/${maxAttempts}, 状态: ${prediction.status}, 已等待: ${elapsedSeconds}s`);

      if (prediction.status === 'succeeded') {
        console.log(`✅ 生成完成，总耗时: ${elapsedSeconds}s`);
        return prediction;
      }

      if (prediction.status === 'failed') {
        throw new Error(`生成失败: ${prediction.error || '未知错误'}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('生成被取消');
      }

      // 如果还在处理中，等待后重试
      if (prediction.status === 'starting' || prediction.status === 'processing') {
        // 🚀 动态调整轮询间隔 - 前期更频繁检查
        const dynamicInterval = attempt <= 5 ? 1500 : pollInterval;
        await new Promise(resolve => setTimeout(resolve, dynamicInterval));
        continue;
      }

      // 未知状态，等待后重试
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      const elapsed = Date.now() - startTime;
      if (attempt === maxAttempts || elapsed > maxWaitTime) {
        console.error(`❌ 轮询最终失败: ${error.message}, 总耗时: ${Math.round(elapsed/1000)}s`);
        throw error;
      }
      console.log(`⚠️ 轮询出错，重试中... ${error.message} (尝试 ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 错误时等待短一些
    }
  }

  throw new Error('生成超时，请稍后重试。某些复杂图像可能需要更长时间。');
}