/**
 * 仓库层统一导出
 * Repository 层负责纯数据库操作，不包含业务逻辑
 */

export { BaseRepository, DeviceFingerprint } from './baseRepository';
export { UserRepository } from './userRepository';
export { GenerationRepository } from './generationRepository';
export type { SaveGenerationParams, PaginationResult } from './generationRepository';
export { TagRepository } from './tagRepository';
export type { TagInput } from './tagRepository';
export { FeedbackRepository } from './feedbackRepository';
export type { FeedbackInput } from './feedbackRepository';
export { TranslationRepository } from './translationRepository';
export { StatsRepository } from './statsRepository';
export { ConfigRepository } from './configRepository';
