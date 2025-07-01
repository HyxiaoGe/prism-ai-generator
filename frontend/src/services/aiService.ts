import type { GenerationConfig, GenerationResult, APIResponse } from '../types';

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:8888/.netlify/functions' 
  : '/.netlify/functions';

export class AIService {
  
  /**
   * 生成图像
   */
  static async generateImage(config: GenerationConfig): Promise<GenerationResult[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: config.prompt,
          model: config.model,
          aspectRatio: config.aspectRatio,
          numInferenceSteps: config.numInferenceSteps,
          outputFormat: config.outputFormat,
        }),
      });

      if (!response.ok) {
        throw new Error(`网络错误: ${response.status}`);
      }

      const result: APIResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }

      // 处理Replicate API响应
      const prediction = result.data;
      
      // Replicate API返回轮询结果
      if (prediction.status === 'succeeded' && prediction.output) {
        return this.formatGenerationResults(prediction.output, config);
      }

      throw new Error(prediction.error || '生成失败');

    } catch (error) {
      console.error('图像生成错误:', error);
      throw error;
    }
  }

  /**
   * 格式化生成结果
   */
  private static formatGenerationResults(
    output: string | string[], 
    config: Partial<GenerationConfig>
  ): GenerationResult[] {
    const urls = Array.isArray(output) ? output : [output];
    
    return urls.map((url, index) => ({
      id: `${Date.now()}-${index}`,
      imageUrl: url,
      prompt: config.prompt || '',
      config: {
        prompt: config.prompt || '',
        aspectRatio: config.aspectRatio || '1:1',
        numOutputs: config.numOutputs || 4,
        outputFormat: config.outputFormat || 'webp',
        numInferenceSteps: config.numInferenceSteps || 4,
        model: config.model || 'flux-schnell',
        // 兼容性字段
        width: this.getWidthFromAspectRatio(config.aspectRatio || '1:1'),
        height: this.getHeightFromAspectRatio(config.aspectRatio || '1:1'),
        steps: config.numInferenceSteps || 4,
        guidance: 7.5, // Flux模型不使用guidance，但保留兼容性
      },
      createdAt: new Date(),
      status: 'completed' as const,
    }));
  }

  /**
   * 根据宽高比获取宽度（用于兼容性显示）
   */
  private static getWidthFromAspectRatio(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      '1:1': 1024,
      '16:9': 1344,
      '9:16': 768,
      '4:3': 1152,
      '3:4': 896,
    };
    return ratioMap[aspectRatio] || 1024;
  }

  /**
   * 根据宽高比获取高度（用于兼容性显示）
   */
  private static getHeightFromAspectRatio(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      '1:1': 1024,
      '16:9': 768,
      '9:16': 1344,
      '4:3': 896,
      '3:4': 1152,
    };
    return ratioMap[aspectRatio] || 1024;
  }

  /**
   * 获取可用模型列表
   */
  static async getAvailableModels() {
    return [
      {
        id: 'flux-schnell',
        name: 'Flux Schnell',
        description: '🚀 超快速生成，4步推理，适合快速原型和创意探索',
        provider: 'replicate' as const,
        isEnabled: true,
        costPerGeneration: 0.003,
        tags: ['快速', '经济', '推荐'],
        defaultConfig: {
          aspectRatio: '1:1' as const,
          numOutputs: 4,
          outputFormat: 'webp' as const,
          numInferenceSteps: 4,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 8,
          supportedFormats: ['webp', 'jpg', 'png'] as ('webp' | 'jpg' | 'png')[],
        }
      },
      {
        id: 'flux-dev',
        name: 'Flux Dev',
        description: '🎨 高质量生成，适合专业创作和精细作品',
        provider: 'replicate' as const,
        isEnabled: true,
        costPerGeneration: 0.055,
        tags: ['高质量', '专业'],
        defaultConfig: {
          aspectRatio: '1:1' as const,
          numOutputs: 4,
          outputFormat: 'webp' as const,
          numInferenceSteps: 28,
        },
        capabilities: {
          supportsAspectRatio: true,
          maxSteps: 50,
          supportedFormats: ['webp', 'jpg', 'png'] as ('webp' | 'jpg' | 'png')[],
        }
      },
      {
        id: 'sdxl-lightning',
        name: 'SDXL Lightning',
        description: '⚡ 字节跳动出品，4步闪电生成，平衡速度与质量',
        provider: 'replicate' as const,
        isEnabled: true,
        costPerGeneration: 0.004,
        tags: ['超快', '平衡'],
        defaultConfig: {
          aspectRatio: '1:1' as const,
          numOutputs: 4,
          outputFormat: 'webp' as const,
          numInferenceSteps: 4,
        },
        capabilities: {
          supportsAspectRatio: false, // 固定1024x1024
          maxSteps: 8,
          supportedFormats: ['webp', 'jpg', 'png'] as ('webp' | 'jpg' | 'png')[],
        }
      },
      {
        id: 'stable-diffusion-xl',
        name: 'Stable Diffusion XL',
        description: '🎭 经典SDXL模型，成熟稳定，社区资源丰富',
        provider: 'replicate' as const,
        isEnabled: true,
        costPerGeneration: 0.009,
        tags: ['经典', '稳定'],
        defaultConfig: {
          aspectRatio: '1:1' as const,
          numOutputs: 4,
          outputFormat: 'webp' as const,
          numInferenceSteps: 20,
        },
        capabilities: {
          supportsAspectRatio: false, // 固定1024x1024
          maxSteps: 50,
          supportedFormats: ['webp', 'jpg', 'png'] as ('webp' | 'jpg' | 'png')[],
        }
      },
    ];
  }
} 