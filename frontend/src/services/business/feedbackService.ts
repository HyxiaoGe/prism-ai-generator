/**
 * 反馈服务
 * 处理图片反馈相关的业务逻辑
 */

import { FeedbackRepository } from '../../repositories';
import { UserService } from './userService';
import { TagService } from './tagService';
import type { ImageFeedback, FeedbackType } from '../../types/database';

export class FeedbackService {
  private static instance: FeedbackService;
  private feedbackRepository: FeedbackRepository;
  private userService: UserService;
  private tagService: TagService;

  private constructor() {
    this.feedbackRepository = FeedbackRepository.getInstance();
    this.userService = UserService.getInstance();
    this.tagService = TagService.getInstance();
  }

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  /**
   * 提交图片反馈
   */
  async submitImageFeedback(params: {
    generationId: string;
    imageUrls: string[];
    feedbackType: FeedbackType;
    tagsUsed: string[];
    modelUsed: string;
  }): Promise<ImageFeedback | null> {
    const user = await this.userService.getOrCreateUser();

    // 检查是否已经对这个批次提交过反馈
    const existing = await this.feedbackRepository.findByGenerationAndUser(
      params.generationId,
      user.id
    );

    if (existing) {
      if (params.feedbackType === null) {
        // 取消反馈 - 删除记录
        await this.feedbackRepository.delete(existing.id);

        // 更新相关标签的成功率
        this.tagService.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);

        return null;
      } else {
        // 更新现有反馈
        const updated = await this.feedbackRepository.update(existing.id, {
          feedbackType: params.feedbackType,
          imageUrls: params.imageUrls,
          tagsUsed: params.tagsUsed,
          modelUsed: params.modelUsed,
        });

        // 更新相关标签的成功率
        this.tagService.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);

        return updated;
      }
    } else {
      // 如果是取消反馈，但没有现有反馈，直接返回 null
      if (params.feedbackType === null) {
        return null;
      }

      // 创建新反馈
      const feedback = await this.feedbackRepository.create({
        generationId: params.generationId,
        userId: user.id,
        imageUrls: params.imageUrls,
        feedbackType: params.feedbackType,
        tagsUsed: params.tagsUsed,
        modelUsed: params.modelUsed,
      });

      // 更新相关标签的成功率
      this.tagService.updateSpecificTagsSuccessRates(params.tagsUsed).catch(console.error);

      return feedback;
    }
  }

  /**
   * 获取生成记录的反馈
   */
  async getImageFeedback(generationId: string): Promise<ImageFeedback[]> {
    return this.feedbackRepository.findByGenerationId(generationId);
  }

  /**
   * 批量获取多个生成记录的反馈
   */
  async getBatchImageFeedback(generationIds: string[]): Promise<Map<string, ImageFeedback[]>> {
    console.log(`🔍 批量查询反馈: ${generationIds.length}个 generation`);
    const result = await this.feedbackRepository.findByGenerationIds(generationIds);
    console.log(`✅ 批量查询完成`);
    return result;
  }
}
