/**
 * 生成相关辅助函数
 * 用于处理 R2 上传、数据库保存和数据转换
 */

import { AIService } from '../../features/ai-models/services/aiService';
import { DatabaseService } from '../../services/database';
import { getTagDisplayName } from '../../constants/tags';
import type { GenerationConfig, GenerationResult } from '../../types';
import type { TagCategory, Generation } from '../../types/database';
import type { GenerationBatch } from '../types';

/**
 * 上传图片到 R2 存储
 */
export async function uploadImagesToR2(
  results: GenerationResult[],
  prompt: string,
  batchId: string
): Promise<GenerationResult[]> {
  try {
    console.log('🚀 开始上传图片到R2存储...');
    const imageUrls = results.map(result => result.imageUrl);
    const uploadResponse = await fetch('/.netlify/functions/upload-to-r2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrls,
        prompt: prompt,
        batchId: batchId,
      }),
    });

    if (uploadResponse.ok || uploadResponse.status === 206) {
      const uploadData = await uploadResponse.json();
      console.log('✅ R2上传响应:', uploadData);

      // 更新results，添加R2 URL信息
      const uploadedResults = results.map((result, index) => {
        const r2Result = uploadData.data.results[index];
        if (!r2Result) return result;

        // 优先使用publicUrl，其次使用签名URL，最后使用原始URL
        const bestUrl = r2Result.publicUrl || r2Result.url || result.imageUrl;

        return {
          ...result,
          // 保留原始URL作为备用
          originalImageUrl: result.imageUrl,
          // 优先使用公共URL
          imageUrl: bestUrl,
          // 添加R2相关信息
          r2Info: {
            key: r2Result.key,
            url: r2Result.url,
            publicUrl: r2Result.publicUrl,
            size: r2Result.size,
            etag: r2Result.etag,
          },
        };
      });

      // 显示成功或部分成功消息
      if (uploadResponse.status === 206 && uploadData.warnings) {
        console.warn('⚠️ 部分上传警告:', uploadData.warnings);
        console.log(`📊 上传统计: ${uploadData.data.uploadedCount}/${uploadData.data.totalCount} 成功`);
      } else {
        console.log('✅ 所有图片上传成功');
      }

      return uploadedResults;
    } else {
      const errorText = await uploadResponse.text().catch(() => '未知错误');
      console.error('❌ R2上传失败:', {
        status: uploadResponse.status,
        error: errorText
      });
      // 保持原始URL，不阻塞整个流程
      console.log('🔄 保持使用原始临时URL');
      return results;
    }
  } catch (r2Error) {
    console.error('❌ R2上传过程中出错:', r2Error);
    // 即使R2上传失败，也继续使用原始URL
    return results;
  }
}

/**
 * 从配置中提取标签数据
 */
export function extractTagsFromConfig(
  config: Partial<GenerationConfig>
): Array<{name: string, category: TagCategory, value: string}> {
  const tagsUsed: Array<{name: string, category: TagCategory, value: string}> = [];
  const selectedTags = config.selectedTags;

  if (!selectedTags) return tagsUsed;

  // 艺术风格
  if (selectedTags.artStyle) {
    tagsUsed.push({
      name: getTagDisplayName(selectedTags.artStyle),
      category: 'art_style' as const,
      value: selectedTags.artStyle
    });
  }

  // 主题风格
  if (selectedTags.themeStyle) {
    tagsUsed.push({
      name: getTagDisplayName(selectedTags.themeStyle),
      category: 'theme_style' as const,
      value: selectedTags.themeStyle
    });
  }

  // 情绪氛围
  if (selectedTags.mood) {
    tagsUsed.push({
      name: getTagDisplayName(selectedTags.mood),
      category: 'mood' as const,
      value: selectedTags.mood
    });
  }

  // 技术参数
  if (selectedTags.technical) {
    selectedTags.technical.forEach(tech => {
      tagsUsed.push({
        name: getTagDisplayName(tech),
        category: 'technical' as const,
        value: tech
      });
    });
  }

  // 构图参数
  if (selectedTags.composition) {
    selectedTags.composition.forEach(comp => {
      tagsUsed.push({
        name: getTagDisplayName(comp),
        category: 'composition' as const,
        value: comp
      });
    });
  }

  // 增强属性
  if (selectedTags.enhancement) {
    selectedTags.enhancement.forEach(enh => {
      tagsUsed.push({
        name: getTagDisplayName(enh),
        category: 'enhancement' as const,
        value: enh
      });
    });
  }

  // 品质增强
  if (selectedTags.isQualityEnhanced) {
    tagsUsed.push({
      name: '品质增强',
      category: 'enhancement' as const,
      value: 'high quality, detailed, masterpiece, best quality, 4k resolution'
    });
  }

  return tagsUsed;
}

/**
 * 保存生成记录到数据库
 */
export async function saveGenerationToDatabase(
  prompt: string,
  config: Partial<GenerationConfig>,
  uploadedResults: GenerationResult[],
  tagsUsed: Array<{name: string, category: TagCategory, value: string}>
): Promise<Generation | null> {
  try {
    const databaseService = DatabaseService.getInstance();

    // 获取模型成本
    const models = await AIService.getAvailableModels();
    const model = models.find(m => m.id === config.model);
    const modelCost = model?.costPerGeneration || 0;

    const savedGeneration = await databaseService.saveGeneration({
      prompt: prompt,
      model_name: config.model || 'flux-schnell',
      model_cost: modelCost,
      image_urls: uploadedResults.map(r => r.imageUrl),
      status: 'completed',
      is_public: true,
      tags_used: tagsUsed,
      // 保存R2相关信息
      original_image_urls: uploadedResults.map(r => r.originalImageUrl).filter((url): url is string => Boolean(url)),
      r2_keys: uploadedResults.map(r => r.r2Info?.key).filter((key): key is string => Boolean(key)),
      r2_data: uploadedResults.map(r => r.r2Info).filter(Boolean),
    });

    // 更新提示词统计
    await databaseService.updatePromptStats(prompt);

    return savedGeneration;
  } catch (dbError) {
    console.error('❌ 保存生成记录失败:', dbError);
    return null;
  }
}

/**
 * 将数据库记录转换为批次格式
 */
export function convertRecordsToBatches(
  records: Generation[]
): { batches: GenerationBatch[], historyResults: GenerationResult[] } {
  const batchesMap = new Map<string, GenerationBatch>();
  const historyResults: GenerationResult[] = [];

  // 按时间降序排列
  records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const record of records) {
    // 处理时区转换：Supabase存储UTC时间，转换为本地时间
    const utcDate = new Date(record.created_at);
    const localDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // UTC+8

    // 处理图片URLs数组，为每张图片创建单独的结果
    const imageUrls = Array.isArray(record.image_urls) ? record.image_urls : [record.image_urls];

    // 为每张图片创建GenerationResult对象
    const batchResults: GenerationResult[] = [];
    imageUrls.forEach((imageUrl, index) => {
      const result: GenerationResult = {
        id: `${record.id}_${index}`,
        imageUrl: imageUrl,
        prompt: record.prompt,
        createdAt: localDate,
        status: record.status as 'completed' | 'failed',
        config: {
          model: record.model_name,
          prompt: record.prompt,
          aspectRatio: '1:1',
          numOutputs: imageUrls.length,
          outputFormat: 'webp',
          numInferenceSteps: 4,
          width: 1024,
          height: 1024,
          steps: 4,
          guidance: 7.5,
        },
        userFeedback: undefined,
        realGenerationId: record.id,
        tags_used: record.tags_used || []
      };

      batchResults.push(result);
      historyResults.push(result);
    });

    // 创建批次键：基于提示词和时间（精确到分钟）
    const timeKey = localDate.toISOString().substring(0, 16);
    const batchKey = `${record.prompt}_${timeKey}`;

    if (!batchesMap.has(batchKey)) {
      // 创建新批次
      const batch: GenerationBatch = {
        id: `batch_${record.id}_${Math.random().toString(36).substr(2, 9)}`,
        prompt: record.prompt,
        config: batchResults[0].config,
        results: batchResults,
        createdAt: localDate,
        model: record.model_name,
        realGenerationId: record.id,
        tags_used: record.tags_used || []
      };
      batchesMap.set(batchKey, batch);
    } else {
      // 添加到现有批次
      const existingBatch = batchesMap.get(batchKey)!;
      existingBatch.results.push(...batchResults);
    }
  }

  // 转换为数组并按时间降序排序
  const batches = Array.from(batchesMap.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { batches, historyResults };
}

/**
 * 生成批次ID
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
