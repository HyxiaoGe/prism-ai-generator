/**
 * 数据库服务类 - 兼容层
 *
 * 此文件作为兼容层，委托给新的 Repository/Service 分层架构。
 * 保持原有 API 不变，以便现有代码平滑迁移。
 *
 * 新代码建议直接使用:
 * - repositories/* - 数据访问层
 * - services/business/* - 业务逻辑层
 */

import { DeviceFingerprint } from '../repositories/baseRepository';
import {
  UserService,
  GenerationService,
  TagService,
  FeedbackService,
  TranslationService
} from './business';
import type {
  User,
  Generation,
  PromptStats,
  DailyStats,
  UserUsageStats,
  TagStats,
  TagCategory,
  ImageFeedback,
  FeedbackType,
  TagRecommendation,
  PopularTagsAnalysis,
  PromptTranslation
} from '../types/database';

// 重新导出 DeviceFingerprint 以保持兼容
export { DeviceFingerprint };

/**
 * 数据库服务类 - 门面模式
 * 内部委托给各个专门的服务
 */
export class DatabaseService {
  private static instance: DatabaseService;

  // 内部服务实例
  private userService: UserService;
  private generationService: GenerationService;
  private tagService: TagService;
  private feedbackService: FeedbackService;
  private translationService: TranslationService;

  private constructor() {
    this.userService = UserService.getInstance();
    this.generationService = GenerationService.getInstance();
    this.tagService = TagService.getInstance();
    this.feedbackService = FeedbackService.getInstance();
    this.translationService = TranslationService.getInstance();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ===== 用户相关方法 =====

  async getOrCreateUser(): Promise<User> {
    return this.userService.getOrCreateUser();
  }

  async getUserUsageStats(): Promise<UserUsageStats> {
    return this.userService.getUserUsageStats();
  }

  async canUserGenerate(): Promise<{ allowed: boolean; reason?: string }> {
    return this.userService.canUserGenerate();
  }

  async recordUsage(userId?: string): Promise<void> {
    return this.userService.recordUsage(userId);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userService.getUserById(userId);
  }

  async getUserFeedbackStats(userId?: string) {
    return this.userService.getUserFeedbackStats(userId);
  }

  // ===== 生成记录相关方法 =====

  async saveGeneration(generation: {
    prompt: string;
    model_name: string;
    model_cost: number;
    image_urls: string[];
    status?: 'pending' | 'completed' | 'failed';
    is_public?: boolean;
    tags_used?: Array<{ name: string; category: TagCategory; value: string }>;
    original_image_urls?: string[];
    r2_keys?: string[];
    r2_data?: any;
  }): Promise<Generation> {
    return this.generationService.saveGeneration(generation);
  }

  async getUserGenerations(limit: number = 50): Promise<Generation[]> {
    return this.generationService.getUserGenerations(limit);
  }

  async getUserGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number;
  } = {}) {
    return this.generationService.getUserGenerationsWithPagination(params);
  }

  async getPublicGenerations(limit: number = 100): Promise<Generation[]> {
    return this.generationService.getPublicGenerations(limit);
  }

  async getPublicGenerationsWithPagination(params: {
    limit?: number;
    offset?: number;
    page?: number;
  } = {}) {
    return this.generationService.getPublicGenerationsWithPagination(params);
  }

  async updatePromptStats(promptText: string): Promise<void> {
    return this.generationService.updatePromptStats(promptText);
  }

  async getPopularPrompts(limit: number = 10): Promise<PromptStats[]> {
    return this.generationService.getPopularPrompts(limit);
  }

  async updateDailyStats(): Promise<void> {
    return this.generationService.updateDailyStats();
  }

  async getDailyStats(days: number = 7): Promise<DailyStats[]> {
    return this.generationService.getDailyStats(days);
  }

  async getDebugGenerationsToday(): Promise<any> {
    return this.generationService.getDebugGenerationsToday();
  }

  async cleanupDuplicateDailyStats(): Promise<void> {
    return this.generationService.cleanupDuplicateDailyStats();
  }

  // ===== 标签统计相关方法 =====

  async updateTagStats(tags: Array<{ name: string; category: TagCategory; value: string }>): Promise<void> {
    return this.tagService.updateTagStats(tags);
  }

  async getPopularTags(category?: TagCategory, limit: number = 10): Promise<TagStats[]> {
    return this.tagService.getPopularTags(category, limit);
  }

  async getTagRecommendations(usedTags: string[] = [], category?: TagCategory, limit: number = 5): Promise<TagRecommendation[]> {
    return this.tagService.getTagRecommendations(usedTags, category, limit);
  }

  async analyzeTagTrends(days: number = 7): Promise<PopularTagsAnalysis[]> {
    return this.tagService.analyzeTagTrends(days);
  }

  async updateSpecificTagsSuccessRates(tagsToUpdate: string[]): Promise<void> {
    return this.tagService.updateSpecificTagsSuccessRates(tagsToUpdate);
  }

  async updateTagSuccessRates(): Promise<void> {
    return this.tagService.updateTagSuccessRates();
  }

  // ===== 图片反馈相关方法 =====

  async submitImageFeedback(params: {
    generationId: string;
    imageUrls: string[];
    feedbackType: FeedbackType;
    tagsUsed: string[];
    modelUsed: string;
  }): Promise<ImageFeedback | null> {
    return this.feedbackService.submitImageFeedback(params);
  }

  async getImageFeedback(generationId: string): Promise<ImageFeedback[]> {
    return this.feedbackService.getImageFeedback(generationId);
  }

  async getBatchImageFeedback(generationIds: string[]): Promise<Map<string, ImageFeedback[]>> {
    return this.feedbackService.getBatchImageFeedback(generationIds);
  }

  // ===== 翻译缓存相关方法 =====

  async getTranslationFromCache(originalPrompt: string): Promise<PromptTranslation | null> {
    return this.translationService.getTranslationFromCache(originalPrompt);
  }

  async saveTranslationToCache(translationData: {
    originalPrompt: string;
    translatedPrompt: string;
    explanation?: string;
    keyTerms?: Array<{ english: string; chinese: string }>;
    confidence?: number;
  }): Promise<PromptTranslation | null> {
    return this.translationService.saveTranslationToCache(translationData);
  }

  async translatePrompt(englishPrompt: string) {
    return this.translationService.translatePrompt(englishPrompt);
  }

  async cleanupOldTranslations(daysOld: number = 30): Promise<void> {
    return this.translationService.cleanupOldTranslations(daysOld);
  }
}
