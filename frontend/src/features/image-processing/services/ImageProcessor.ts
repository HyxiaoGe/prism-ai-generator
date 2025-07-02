// 图像处理选项
export interface ImageProcessingOptions {
  // 格式转换
  targetFormat?: 'webp' | 'jpeg' | 'png' | 'avif';
  quality?: number; // 0-1
  
  // 尺寸调整
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'pad';
  
  // 压缩选项
  enableProgressive?: boolean;
  
  // 滤镜效果
  brightness?: number; // -1 to 1
  contrast?: number; // -1 to 1
  saturation?: number; // -1 to 1
  blur?: number; // 0 to 10
  
  // 裁剪
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

// 图像元数据
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  colorSpace?: string;
  hasAlpha?: boolean;
  exif?: Record<string, any>;
  created?: Date;
}

// 处理结果
export interface ProcessingResult {
  blob: Blob;
  dataUrl: string;
  metadata: ImageMetadata;
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
}

/**
 * 客户端图像处理器
 * 支持格式转换、尺寸调整、压缩、滤镜等功能
 */
export class ImageProcessor {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建Canvas上下文');
    }
    this.context = ctx;
  }

  /**
   * 处理图像文件
   */
  async processImage(
    input: File | Blob | string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // 加载图像
    const { image, originalMetadata } = await this.loadImage(input);
    
    // 计算目标尺寸
    const targetDimensions = this.calculateTargetDimensions(
      image.width,
      image.height,
      options
    );
    
    // 设置画布尺寸
    this.canvas.width = targetDimensions.width;
    this.canvas.height = targetDimensions.height;
    
    // 应用背景色（如果需要）
    if (options.resizeMode === 'pad') {
      this.context.fillStyle = '#ffffff';
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 清空画布
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 应用滤镜效果
    this.applyFilters(options);
    
    // 绘制图像
    this.drawImage(image, targetDimensions, options);
    
    // 生成输出
    const result = await this.generateOutput(originalMetadata, options);
    
    return result;
  }

  /**
   * 批量处理图像
   */
  async batchProcess(
    inputs: (File | Blob | string)[],
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    for (const input of inputs) {
      try {
        const result = await this.processImage(input, options);
        results.push(result);
      } catch (error) {
        console.error('批量处理失败:', error);
        // 继续处理其他图像
      }
    }
    
    return results;
  }

  /**
   * 获取图像元数据
   */
  async getMetadata(input: File | Blob | string): Promise<ImageMetadata> {
    const { originalMetadata } = await this.loadImage(input);
    return originalMetadata;
  }

  /**
   * 压缩图像
   */
  async compressImage(
    input: File | Blob | string,
    targetSizeKB: number,
    maxIterations: number = 10
  ): Promise<ProcessingResult> {
    let quality = 0.9;
    let result: ProcessingResult;
    let iterations = 0;
    
    do {
      result = await this.processImage(input, {
        targetFormat: 'webp',
        quality,
        maintainAspectRatio: true
      });
      
      const sizeKB = result.processedSize / 1024;
      
      if (sizeKB <= targetSizeKB || iterations >= maxIterations) {
        break;
      }
      
      // 调整质量
      quality *= targetSizeKB / sizeKB * 0.9;
      quality = Math.max(0.1, Math.min(0.9, quality));
      iterations++;
      
    } while (true);
    
    return result;
  }

  /**
   * 创建缩略图
   */
  async createThumbnail(
    input: File | Blob | string,
    size: number = 150
  ): Promise<ProcessingResult> {
    return this.processImage(input, {
      width: size,
      height: size,
      maintainAspectRatio: true,
      resizeMode: 'cover',
      targetFormat: 'webp',
      quality: 0.8
    });
  }

  /**
   * 加载图像
   */
  private async loadImage(input: File | Blob | string): Promise<{
    image: HTMLImageElement;
    originalMetadata: ImageMetadata;
  }> {
    const image = new Image();
    
    return new Promise((resolve, reject) => {
      image.onload = () => {
        const metadata: ImageMetadata = {
          width: image.width,
          height: image.height,
          format: this.detectFormat(input),
          size: input instanceof File ? input.size : 0,
          hasAlpha: this.hasAlphaChannel(image)
        };
        
        resolve({ image, originalMetadata: metadata });
      };
      
      image.onerror = () => reject(new Error('图像加载失败'));
      
      if (typeof input === 'string') {
        image.src = input;
      } else {
        const url = URL.createObjectURL(input);
        image.src = url;
        
        // 清理URL
        image.onload = () => {
          URL.revokeObjectURL(url);
          const metadata: ImageMetadata = {
            width: image.width,
            height: image.height,
            format: this.detectFormat(input),
            size: input instanceof File ? input.size : 0,
            hasAlpha: this.hasAlphaChannel(image)
          };
          
          resolve({ image, originalMetadata: metadata });
        };
      }
    });
  }

  /**
   * 计算目标尺寸
   */
  private calculateTargetDimensions(
    originalWidth: number,
    originalHeight: number,
    options: ImageProcessingOptions
  ): { width: number; height: number; x: number; y: number; scale: number } {
    let { width = originalWidth, height = originalHeight } = options;
    
    if (options.maintainAspectRatio !== false) {
      const aspectRatio = originalWidth / originalHeight;
      
      switch (options.resizeMode) {
        case 'contain':
          if (width / height > aspectRatio) {
            width = height * aspectRatio;
          } else {
            height = width / aspectRatio;
          }
          break;
          
        case 'cover':
          if (width / height > aspectRatio) {
            height = width / aspectRatio;
          } else {
            width = height * aspectRatio;
          }
          break;
          
        case 'pad':
          // 保持原始尺寸比例，在指定区域内居中
          const scale = Math.min(width / originalWidth, height / originalHeight);
          const scaledWidth = originalWidth * scale;
          const scaledHeight = originalHeight * scale;
          
          return {
            width,
            height,
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2,
            scale
          };
      }
    }
    
    return {
      width: Math.round(width),
      height: Math.round(height),
      x: 0,
      y: 0,
      scale: 1
    };
  }

  /**
   * 应用滤镜效果
   */
  private applyFilters(options: ImageProcessingOptions): void {
    const filters: string[] = [];
    
    if (options.brightness !== undefined) {
      const brightness = 100 + (options.brightness * 100);
      filters.push(`brightness(${brightness}%)`);
    }
    
    if (options.contrast !== undefined) {
      const contrast = 100 + (options.contrast * 100);
      filters.push(`contrast(${contrast}%)`);
    }
    
    if (options.saturation !== undefined) {
      const saturation = 100 + (options.saturation * 100);
      filters.push(`saturate(${saturation}%)`);
    }
    
    if (options.blur !== undefined && options.blur > 0) {
      filters.push(`blur(${options.blur}px)`);
    }
    
    if (filters.length > 0) {
      this.context.filter = filters.join(' ');
    }
  }

  /**
   * 绘制图像
   */
  private drawImage(
    image: HTMLImageElement,
    dimensions: { width: number; height: number; x: number; y: number; scale: number },
    options: ImageProcessingOptions
  ): void {
    if (options.cropWidth && options.cropHeight) {
      // 裁剪模式
      this.context.drawImage(
        image,
        options.cropX || 0,
        options.cropY || 0,
        options.cropWidth,
        options.cropHeight,
        dimensions.x,
        dimensions.y,
        dimensions.width,
        dimensions.height
      );
    } else if (options.resizeMode === 'pad') {
      // 填充模式
      this.context.drawImage(
        image,
        dimensions.x,
        dimensions.y,
        image.width * dimensions.scale,
        image.height * dimensions.scale
      );
    } else {
      // 标准缩放
      this.context.drawImage(
        image,
        dimensions.x,
        dimensions.y,
        dimensions.width,
        dimensions.height
      );
    }
  }

  /**
   * 生成输出
   */
  private async generateOutput(
    originalMetadata: ImageMetadata,
    options: ImageProcessingOptions
  ): Promise<ProcessingResult> {
    const format = options.targetFormat || 'webp';
    const quality = options.quality || 0.9;
    
    // 转换为Blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图像转换失败'));
          }
        },
        `image/${format}`,
        quality
      );
    });
    
    // 生成Data URL
    const dataUrl = this.canvas.toDataURL(`image/${format}`, quality);
    
    // 创建新的元数据
    const metadata: ImageMetadata = {
      width: this.canvas.width,
      height: this.canvas.height,
      format,
      size: blob.size,
      hasAlpha: format === 'png' || originalMetadata.hasAlpha
    };
    
    return {
      blob,
      dataUrl,
      metadata,
      originalSize: originalMetadata.size,
      processedSize: blob.size,
      compressionRatio: originalMetadata.size > 0 ? blob.size / originalMetadata.size : 1
    };
  }

  /**
   * 检测图像格式
   */
  private detectFormat(input: File | Blob | string): string {
    if (typeof input === 'string') {
      // 从URL检测
      const ext = input.split('.').pop()?.toLowerCase();
      return ext || 'unknown';
    } else if (input instanceof File) {
      return input.type.split('/')[1] || 'unknown';
    } else {
      return input.type.split('/')[1] || 'unknown';
    }
  }

  /**
   * 检测是否有透明通道
   */
  private hasAlphaChannel(image: HTMLImageElement): boolean {
    // 创建临时画布检测Alpha
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return false;
    
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    tempCtx.drawImage(image, 0, 0, 1, 1);
    
    const imageData = tempCtx.getImageData(0, 0, 1, 1);
    return imageData.data[3] < 255;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 清理画布
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
} 