/**
 * 反馈仓库
 * 处理图片反馈相关的数据库操作
 */

import { BaseRepository } from './baseRepository';
import type { ImageFeedback, FeedbackType } from '../types/database';

export interface FeedbackInput {
  generationId: string;
  userId: string;
  imageUrls: string[];
  feedbackType: FeedbackType;
  tagsUsed: string[];
  modelUsed: string;
}

export class FeedbackRepository extends BaseRepository {
  private static instance: FeedbackRepository;

  private constructor() {
    super();
  }

  static getInstance(): FeedbackRepository {
    if (!FeedbackRepository.instance) {
      FeedbackRepository.instance = new FeedbackRepository();
    }
    return FeedbackRepository.instance;
  }

  /**
   * 查找用户对某个生成记录的反馈
   */
  async findByGenerationAndUser(generationId: string, userId: string): Promise<ImageFeedback | null> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .select('*')
      .eq('generation_id', generationId)
      .eq('user_id', userId)
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw new Error(`查询反馈失败: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * 创建反馈
   */
  async create(input: FeedbackInput): Promise<ImageFeedback> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .insert({
        generation_id: input.generationId,
        user_id: input.userId,
        image_urls: input.imageUrls,
        feedback_type: input.feedbackType,
        tags_used: input.tagsUsed,
        model_used: input.modelUsed,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建反馈失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 更新反馈
   */
  async update(
    feedbackId: string,
    updates: Partial<Pick<FeedbackInput, 'feedbackType' | 'imageUrls' | 'tagsUsed' | 'modelUsed'>>
  ): Promise<ImageFeedback | null> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .update({
        feedback_type: updates.feedbackType,
        image_urls: updates.imageUrls,
        tags_used: updates.tagsUsed,
        model_used: updates.modelUsed,
      })
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`更新反馈失败: ${error.message}`);
    }

    return data;
  }

  /**
   * 删除反馈
   */
  async delete(feedbackId: string): Promise<void> {
    const { error } = await this.supabase
      .from('image_feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) {
      throw new Error(`删除反馈失败: ${error.message}`);
    }
  }

  /**
   * 获取生成记录的所有反馈
   */
  async findByGenerationId(generationId: string): Promise<ImageFeedback[]> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .select(`
        id, generation_id, image_urls, feedback_type, created_at
      `)
      .eq('generation_id', generationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`获取反馈失败: ${error.message}`);
    }

    return (data || []).map((record: any) => ({
      ...record,
      user_id: 'current_user',
      tags_used: [],
      model_used: '',
    }));
  }

  /**
   * 批量获取多个生成记录的反馈
   */
  async findByGenerationIds(generationIds: string[]): Promise<Map<string, ImageFeedback[]>> {
    if (generationIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from('image_feedback')
      .select(`
        id, generation_id, image_urls, feedback_type, created_at
      `)
      .in('generation_id', generationIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`批量获取反馈失败: ${error.message}`);
    }

    const feedbackMap = new Map<string, ImageFeedback[]>();

    (data || []).forEach((record: any) => {
      const feedback: ImageFeedback = {
        ...record,
        user_id: 'current_user',
        tags_used: [],
        model_used: '',
      };

      if (!feedbackMap.has(record.generation_id)) {
        feedbackMap.set(record.generation_id, []);
      }
      feedbackMap.get(record.generation_id)!.push(feedback);
    });

    return feedbackMap;
  }

  /**
   * 获取用户的所有反馈（仅反馈类型，用于统计）
   */
  async findByUserId(userId: string): Promise<Array<{ feedback_type: FeedbackType }>> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .select('feedback_type')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`获取用户反馈失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取所有反馈数据（用于计算标签成功率）
   */
  async findAll(): Promise<Array<{ tags_used: string[]; feedback_type: FeedbackType; image_urls: string[] }>> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .select('tags_used, feedback_type, image_urls');

    if (error) {
      throw new Error(`获取反馈数据失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 获取包含指定标签的反馈
   */
  async findByTags(tagsToMatch: string[]): Promise<Array<{ tags_used: string[]; feedback_type: FeedbackType; image_urls: string[] }>> {
    const { data, error } = await this.supabase
      .from('image_feedback')
      .select('tags_used, feedback_type, image_urls')
      .overlaps('tags_used', tagsToMatch);

    if (error) {
      console.error('获取相关反馈数据失败:', error);
      return [];
    }

    return data || [];
  }
}
