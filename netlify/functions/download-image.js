/**
 * 图片下载代理服务 - 解决CORS问题
 */
exports.handler = async (event, context) => {
  // 🔧 确保函数不会提前结束
  context.callbackWaitsForEmptyEventLoop = false;

  // 处理CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '仅支持GET请求' })
    };
  }

  try {
    const { imageUrl, filename } = event.queryStringParameters || {};

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少imageUrl参数' })
      };
    }

    console.log('🖼️ 开始代理下载图片:', imageUrl);

    // 从R2存储获取图片
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'PrismAI-ImageDownloader/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
    }

    // 获取图片数据
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 生成文件名
    const finalFilename = filename || `prism-ai-image-${Date.now()}.jpg`;
    
    console.log(`✅ 图片下载成功: ${imageBuffer.byteLength} bytes, 类型: ${contentType}`);

    // 返回图片数据，设置下载头部
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600' // 缓存1小时
      },
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ 图片下载失败:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `图片下载失败: ${error.message}`,
        details: error.stack
      })
    };
  }
};