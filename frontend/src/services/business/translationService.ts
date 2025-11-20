/**
 * 翻译服务
 * 处理提示词翻译相关的业务逻辑
 */

import { TranslationRepository } from '../../repositories';
import type { PromptTranslation } from '../../types/database';

export class TranslationService {
  private static instance: TranslationService;
  private translationRepository: TranslationRepository;

  private constructor() {
    this.translationRepository = TranslationRepository.getInstance();
  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * 生成提示词哈希值
   */
  private generatePromptHash(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从缓存获取翻译结果
   */
  async getTranslationFromCache(originalPrompt: string): Promise<PromptTranslation | null> {
    const promptHash = this.generatePromptHash(originalPrompt.trim().toLowerCase());
    return this.translationRepository.findByHash(promptHash);
  }

  /**
   * 保存翻译结果到缓存
   */
  async saveTranslationToCache(translationData: {
    originalPrompt: string;
    translatedPrompt: string;
    explanation?: string;
    keyTerms?: Array<{ english: string; chinese: string }>;
    confidence?: number;
  }): Promise<PromptTranslation | null> {
    const promptHash = this.generatePromptHash(translationData.originalPrompt.trim().toLowerCase());

    // 确保 confidence 在 0-1 范围内（数据库字段是 numeric(3,2)，最大值 9.99）
    let normalizedConfidence = translationData.confidence;
    if (normalizedConfidence !== undefined) {
      // 如果 confidence >= 1，说明是百分比形式（如 95），需要除以 100
      if (normalizedConfidence >= 1) {
        normalizedConfidence = normalizedConfidence / 100;
      }
      // 确保在有效范围内 [0, 1]
      normalizedConfidence = Math.max(0, Math.min(1, normalizedConfidence));
    }

    const result = await this.translationRepository.upsert({
      originalPrompt: translationData.originalPrompt,
      promptHash,
      translatedPrompt: translationData.translatedPrompt,
      explanation: translationData.explanation,
      keyTerms: translationData.keyTerms,
      confidence: normalizedConfidence,
    });

    if (result) {
      console.log('💾 翻译结果已缓存');
    }

    return result;
  }

  /**
   * 翻译英文提示词（带缓存）
   */
  async translatePrompt(englishPrompt: string): Promise<{
    originalPrompt: string;
    chineseTranslation: string;
    explanation?: string;
    keyTerms?: Array<{ english: string; chinese: string }>;
    confidence: number;
    fromCache: boolean;
  }> {
    // 先查询缓存
    const cachedResult = await this.getTranslationFromCache(englishPrompt);
    if (cachedResult) {
      console.log('🎯 命中翻译缓存');
      return {
        originalPrompt: cachedResult.original_prompt,
        chineseTranslation: cachedResult.translated_prompt,
        explanation: cachedResult.translation_explanation,
        keyTerms: cachedResult.key_terms,
        confidence: cachedResult.confidence,
        fromCache: true,
      };
    }

    // 缓存未命中，调用 API 翻译
    console.log('🌐 缓存未命中，调用翻译 API...');
    try {
      const response = await fetch('/.netlify/functions/translate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ englishPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`翻译 API 失败: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const apiResult = await response.json();

      // 保存到缓存
      await this.saveTranslationToCache({
        originalPrompt: englishPrompt,
        translatedPrompt: apiResult.chineseTranslation,
        explanation: apiResult.explanation,
        keyTerms: apiResult.keyTerms,
        confidence: apiResult.confidence,
      });

      return {
        originalPrompt: apiResult.originalPrompt,
        chineseTranslation: apiResult.chineseTranslation,
        explanation: apiResult.explanation,
        keyTerms: apiResult.keyTerms,
        confidence: apiResult.confidence,
        fromCache: false,
      };

    } catch (error) {
      console.error('翻译失败:', error);
      // 返回降级结果
      return {
        originalPrompt: englishPrompt,
        chineseTranslation: `[翻译] ${englishPrompt}`,
        explanation: '翻译服务暂时不可用',
        keyTerms: [],
        confidence: 0,
        fromCache: false,
      };
    }
  }

  /**
   * 清理过期的翻译缓存
   */
  async cleanupOldTranslations(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000)).toISOString();
    await this.translationRepository.deleteOlderThan(cutoffDate);
    console.log(`🧹 已清理${daysOld}天前的翻译缓存`);
  }
}
