import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2存储配置接口
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string; // 如果配置了公共访问，可以使用公共URL
}

// 上传结果接口
interface UploadResult {
  key: string;
  url: string;
  publicUrl?: string;
  size: number;
  etag: string;
}

/**
 * Cloudflare R2 存储服务
 */
export class R2StorageService {
  private static instance: R2StorageService;
  private s3Client: S3Client;
  private config: R2Config;

  private constructor(config: R2Config) {
    this.config = config;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // 兼容性配置，避免checksum问题
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * 获取R2Storage实例（单例模式）
   */
  static getInstance(config?: R2Config): R2StorageService {
    if (!R2StorageService.instance) {
      if (!config) {
        throw new Error('R2Storage配置不能为空');
      }
      R2StorageService.instance = new R2StorageService(config);
    }
    return R2StorageService.instance;
  }

  /**
   * 从环境变量初始化配置
   */
  static initFromEnv(): R2StorageService {
    const config: R2Config = {
      accountId: import.meta.env.VITE_R2_ACCOUNT_ID || '',
      accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '',
      bucketName: import.meta.env.VITE_R2_BUCKET_NAME || '',
      publicUrl: import.meta.env.VITE_R2_PUBLIC_URL || undefined,
    };

    // 验证必要的配置
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new Error('R2配置不完整，请检查环境变量');
    }

    return R2StorageService.getInstance(config);
  }

  /**
   * 上传图片到R2存储
   */
  async uploadImage(imageUrl: string, fileName: string): Promise<UploadResult> {
    try {
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
      const extension = this.getFileExtension(contentType);
      
      // 生成日期路径：YYYY-MM-DD
      const dateStr = now.toISOString().split('T')[0]; // 获取 YYYY-MM-DD 格式
      const key = `ai-images/${dateStr}/${timestamp}-${randomId}-${fileName}${extension}`;

      // 3. 上传到R2
      const putCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: new Uint8Array(imageBuffer),
        ContentType: contentType,
        // 设置缓存控制，提高访问性能
        CacheControl: 'public, max-age=31536000', // 1年
        // 设置元数据
        Metadata: {
          'original-url': imageUrl,
          'upload-source': 'ai-generator',
          'upload-timestamp': timestamp.toString(),
        },
      });

      const result = await this.s3Client.send(putCommand);

      // 4. 生成访问URL
      const permanentUrl = await this.getPermanentUrl(key);
      const publicUrl = this.config.publicUrl 
        ? `${this.config.publicUrl}/${key}`
        : undefined;

      return {
        key,
        url: permanentUrl,
        publicUrl,
        size: imageBuffer.byteLength,
        etag: result.ETag || '',
      };

    } catch (error) {
      console.error('上传图片到R2失败:', error);
      throw new Error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成永久访问URL（带签名）
   */
  async getPermanentUrl(key: string, expiresIn: number = 365 * 24 * 60 * 60): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * 批量上传图片
   */
  async uploadImages(imageUrls: string[], baseFileName: string): Promise<UploadResult[]> {
    const uploadPromises = imageUrls.map((url, index) => {
      const fileName = `${baseFileName}-${index + 1}`;
      return this.uploadImage(url, fileName);
    });

    try {
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('批量上传失败:', error);
      throw error;
    }
  }

  /**
   * 根据内容类型获取文件扩展名
   */
  private getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };
    return extensions[contentType] || '.jpg';
  }

  /**
   * 生成文件名（基于提示词）
   */
  static generateFileName(prompt: string): string {
    // 清理提示词，只保留字母数字和中文
    const cleanPrompt = prompt
      .replace(/[^\w\u4e00-\u9fa5\s]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);

    return cleanPrompt || 'ai-image';
  }
}

// 默认导出单例获取方法
export default R2StorageService; 