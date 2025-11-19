/**
 * 标签服务
 * 处理标签统计相关的业务逻辑
 */

import { TagRepository, FeedbackRepository } from '../../repositories';
import type { TagStats, TagCategory, TagRecommendation, PopularTagsAnalysis } from '../../types/database';

export class TagService {
  private static instance: TagService;
  private tagRepository: TagRepository;
  private feedbackRepository: FeedbackRepository;

  private constructor() {
    this.tagRepository = TagRepository.getInstance();
    this.feedbackRepository = FeedbackRepository.getInstance();
  }

  static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  /**
   * 记录标签使用统计
   */
  async updateTagStats(tags: Array<{ name: string; category: TagCategory; value: string }>): Promise<void> {
    if (!tags || tags.length === 0) return;

    console.log('📊 极简优化：单次批量 upsert 标签统计:', tags.length, '个标签');
    await this.tagRepository.upsertMany(tags);
    console.log(`✅ 极简优化完成 - 标签统计更新: ${tags.length}个标签，仅用1次数据库请求！`);
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(category?: TagCategory, limit: number = 10): Promise<TagStats[]> {
    return this.tagRepository.findPopular(category, limit);
  }

  /**
   * 获取标签推荐
   */
  async getTagRecommendations(
    usedTags: string[] = [],
    category?: TagCategory,
    limit: number = 5
  ): Promise<TagRecommendation[]> {
    const tags = await this.tagRepository.findRecommendations(usedTags, category, limit);

    return tags.map(tag => {
      let score = tag.usage_count;
      let reason = `热门标签 (${tag.usage_count}次使用)`;

      if (tag.success_rate > 0.7) {
        score *= 1.2;
        reason += ', 高成功率';
      }

      if (tag.average_rating > 4) {
        score *= 1.1;
        reason += ', 高评分';
      }

      return {
        tag,
        score: Math.round(score),
        reason,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 分析标签趋势
   */
  async analyzeTagTrends(days: number = 7): Promise<PopularTagsAnalysis[]> {
    const categories: TagCategory[] = [
      'art_style', 'theme_style', 'mood', 'technical', 'composition', 'enhancement'
    ];
    const results: PopularTagsAnalysis[] = [];

    for (const category of categories) {
      const tags = await this.tagRepository.findByCategory(category, 10);
      const totalUsage = tags.reduce((sum, tag) => sum + tag.usage_count, 0);

      results.push({
        category,
        tags,
        total_usage: totalUsage,
        growth_rate: 0,
      });
    }

    return results;
  }

  /**
   * 更新指定标签的成功率
   */
  async updateSpecificTagsSuccessRates(tagsToUpdate: string[]): Promise<void> {
    if (!tagsToUpdate || tagsToUpdate.length === 0) {
      console.log('📊 没有标签需要更新成功率');
      return;
    }

    console.log(`📊 优化更新 ${tagsToUpdate.length} 个指定标签的成功率...`);

    const feedbacks = await this.feedbackRepository.findByTags(tagsToUpdate);

    // 统计指定标签的反馈情况
    const tagFeedbackMap = new Map<string, { likes: number; total: number }>();
    tagsToUpdate.forEach(tagName => {
      tagFeedbackMap.set(tagName, { likes: 0, total: 0 });
    });

    feedbacks.forEach(feedback => {
      feedback.tags_used?.forEach(tagName => {
        if (tagFeedbackMap.has(tagName)) {
          const stats = tagFeedbackMap.get(tagName)!;
          const imageCount = feedback.image_urls?.length || 1;
          stats.total += imageCount;
          if (feedback.feedback_type === 'like') {
            stats.likes += imageCount;
          }
        }
      });
    });

    // 更新有数据的标签
    const updates = Array.from(tagFeedbackMap.entries())
      .filter(([_, stats]) => stats.total > 0)
      .map(([tagName, stats]) => {
        const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
        return {
          tagName,
          successRate,
          averageRating: successRate * 5,
        };
      });

    if (updates.length > 0) {
      await this.tagRepository.batchUpdateSuccessRates(updates);
      console.log(`✅ 优化更新完成: ${updates.length} 个标签`);
    }
  }

  /**
   * 基于反馈更新所有标签成功率
   */
  async updateTagSuccessRates(): Promise<void> {
    const feedbacks = await this.feedbackRepository.findAll();

    // 统计每个标签的反馈情况
    const tagFeedbackMap = new Map<string, { likes: number; total: number }>();

    feedbacks.forEach(feedback => {
      feedback.tags_used?.forEach(tagName => {
        if (!tagFeedbackMap.has(tagName)) {
          tagFeedbackMap.set(tagName, { likes: 0, total: 0 });
        }

        const stats = tagFeedbackMap.get(tagName)!;
        const imageCount = feedback.image_urls?.length || 1;
        stats.total += imageCount;
        if (feedback.feedback_type === 'like') {
          stats.likes += imageCount;
        }
      });
    });

    // 批量更新标签成功率
    if (tagFeedbackMap.size > 0) {
      console.log(`📊 批量更新 ${tagFeedbackMap.size} 个标签的成功率...`);

      const updates = Array.from(tagFeedbackMap.entries()).map(([tagName, stats]) => {
        const successRate = stats.total > 0 ? stats.likes / stats.total : 0;
        return {
          tagName,
          successRate,
          averageRating: successRate * 5,
        };
      });

      await this.tagRepository.batchUpdateSuccessRates(updates);
      console.log(`✅ 批量更新成功率完成`);
    }
  }
}
