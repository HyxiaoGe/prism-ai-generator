const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// R2客户端配置
const createR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('缺少R2配置环境变量');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // 兼容性配置
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
};

// 根据内容类型获取文件扩展名
const getFileExtension = (contentType) => {
  const extensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  return extensions[contentType] || '.jpg';
};

// 生成文件名
const generateFileName = (prompt) => {
  const cleanPrompt = prompt
    .replace(/[^\w\u4e00-\u9fa5\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
  
  return cleanPrompt || 'ai-image';
};

// 上传单个图片到R2
const uploadImageToR2 = async (s3Client, imageUrl, fileName, bucketName, publicUrl) => {
  try {
    console.log(`开始上传图片: ${imageUrl}`);
    
    // 1. 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 2. 生成唯一的文件名（按日期分组）
    const now = new Date();
    const timestamp = now.getTime();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = getFileExtension(contentType);
    
    // 生成日期路径：YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0]; // 获取 YYYY-MM-DD 格式
    const key = `ai-images/${dateStr}/${timestamp}-${randomId}-${fileName}${extension}`;

    console.log(`📁 文件路径结构:`, {
      日期目录: dateStr,
      完整路径: key,
      文件名: `${timestamp}-${randomId}-${fileName}${extension}`
    });

    // 3. 上传到R2
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: new Uint8Array(imageBuffer),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
      Metadata: {
        'original-url': imageUrl,
        'upload-source': 'ai-generator',
        'upload-timestamp': timestamp.toString(),
      },
    });

    const result = await s3Client.send(putCommand);
    console.log(`上传成功: ${key}`);

    // 4. 生成访问URL
    let signedUrl;
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      signedUrl = await getSignedUrl(s3Client, getCommand, { 
        expiresIn: 365 * 24 * 60 * 60 // 1年
      });
      console.log(`✅ 签名URL生成成功: ${key}`);
    } catch (urlError) {
      console.error('⚠️ 签名URL生成失败，使用备用方案:', urlError);
      // 备用方案：使用基础URL
      signedUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${key}`;
    }

    const finalPublicUrl = publicUrl ? `${publicUrl}/${key}` : undefined;

    const uploadResult = {
      key,
      url: signedUrl,
      publicUrl: finalPublicUrl,
      size: imageBuffer.byteLength,
      etag: result.ETag || '',
    };

    console.log(`📊 上传结果:`, JSON.stringify(uploadResult, null, 2));
    return uploadResult;

  } catch (error) {
    console.error('上传图片失败:', error);
    throw error;
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '仅支持POST方法' }),
    };
  }

  try {
    const { imageUrls, prompt, batchId } = JSON.parse(event.body);

    console.log(`收到上传请求 - 批次ID: ${batchId}, 图片数量: ${imageUrls?.length}`);

    // 验证输入
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少图片URL数组' }),
      };
    }

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少提示词' }),
      };
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    
    // 🔥 新增：调试日志，显示当前配置
    console.log('🔧 R2配置信息:');
    console.log(`  - Account ID: ${process.env.R2_ACCOUNT_ID ? '已配置' : '❌ 缺失'}`);
    console.log(`  - Bucket Name: ${bucketName || '❌ 缺失'}`);
    console.log(`  - Public URL: ${publicUrl || '⚠️ 未配置（将使用签名URL）'}`);

    if (!bucketName) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '缺少存储桶配置' }),
      };
    }

    // 创建R2客户端
    const s3Client = createR2Client();

    // 生成基础文件名
    const baseFileName = generateFileName(prompt);

    // 批量上传图片 - 使用 Promise.allSettled 处理部分失败
    const uploadPromises = imageUrls.map((url, index) => {
      const fileName = `${baseFileName}-${index + 1}`;
      return uploadImageToR2(s3Client, url, fileName, bucketName, publicUrl);
    });

    console.log(`开始批量上传 ${uploadPromises.length} 张图片...`);
    const settledResults = await Promise.allSettled(uploadPromises);
    
    // 分离成功和失败的结果
    const results = [];
    const errors = [];
    
    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        console.log(`✅ 图片 ${index + 1} 上传成功`);
      } else {
        errors.push({ index: index + 1, error: result.reason });
        console.error(`❌ 图片 ${index + 1} 上传失败:`, result.reason);
      }
    });

    console.log(`📈 批量上传完成 - 成功: ${results.length}, 失败: ${errors.length}`);

    // 构建响应数据
    const responseData = {
      batchId,
      results,
      errors,
      totalSize: results.reduce((sum, r) => sum + r.size, 0),
      uploadedCount: results.length,
      failedCount: errors.length,
      totalCount: imageUrls.length,
    };

    // 判断是否完全成功
    const isFullSuccess = errors.length === 0;
    const hasAnySuccess = results.length > 0;

    if (isFullSuccess) {
      // 全部成功
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `成功上传 ${results.length} 张图片`,
          data: responseData,
        }),
      };
    } else if (hasAnySuccess) {
      // 部分成功
      return {
        statusCode: 206, // Partial Content
        headers,
        body: JSON.stringify({
          success: true,
          message: `部分上传成功：${results.length}/${imageUrls.length} 张图片`,
          data: responseData,
          warnings: [`${errors.length} 张图片上传失败`],
        }),
      };
    } else {
      // 全部失败
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: '所有图片上传失败',
          data: responseData,
          error: '批量上传失败',
        }),
      };
    }

  } catch (error) {
    console.error('R2上传处理错误:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '上传失败',
        message: error.message,
        success: false,
      }),
    };
  }
}; 