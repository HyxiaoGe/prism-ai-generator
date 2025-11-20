/**
 * 翻译仓库
 * 处理提示词翻译缓存相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { PromptTranslation } from '../types/database';

export class TranslationRepository extends BaseRepository {
  private static instance: TranslationRepository;

  private constructor() {
    super();
  }

  static getInstance(): TranslationRepository {
    if (!TranslationRepository.instance) {
      TranslationRepository.instance = new TranslationRepository();
    }
    return TranslationRepository.instance;
  }

  /**
   * 根据哈希值查找翻译缓存
   */
  async findByHash(promptHash: string): Promise<PromptTranslation | null> {
    const { data, error } = await this.supabase
      .from('prompt_translations')
      .select('*')
      .eq('original_prompt_hash', promptHash)
      .maybeSingle();

    if (error) {
      console.error('获取翻译缓存失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 保存翻译到缓存
   */
  async upsert(params: {
    originalPrompt: string;
    promptHash: string;
    translatedPrompt: string;
    explanation?: string;
    keyTerms?: Array<{ english: string; chinese: string }>;
    confidence?: number;
  }): Promise<PromptTranslation | null> {
    const { data, error } = await this.supabase
      .from('prompt_translations')
      .upsert({
        original_prompt: params.originalPrompt,
        original_prompt_hash: params.promptHash,
        translated_prompt: params.translatedPrompt,
        translation_explanation: params.explanation || null,
        key_terms: params.keyTerms || [],
        confidence: params.confidence || 95,
      }, {
        onConflict: 'original_prompt_hash'
      })
      .select()
      .single();

    if (error) {
      console.error('保存翻译缓存失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 清理过期的翻译缓存
   */
  async deleteOlderThan(cutoffDate: string): Promise<void> {
    const { error } = await this.supabase
      .from('prompt_translations')
      .delete()
      .lt('created_at', cutoffDate);

    if (error) {
      console.error('清理翻译缓存失败:', error);
    }
  }
}
