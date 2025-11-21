/**
 * 标签映射服务
 * 负责将场景包的简化标签值映射到完整的提示词
 * 解决场景包标签和 tags.ts 定义不一致的问题
 */

import {
  ART_STYLE_TAGS,
  THEME_STYLE_TAGS,
  MOOD_TAGS,
  TECHNICAL_TAGS,
  COMPOSITION_TAGS,
  ENHANCEMENT_TAGS,
  type Tag,
} from '@/constants/tags';
import type { TagCategory } from '@/types/database';

// 标签分类枚举
export type TagCategoryKey =
  | 'artStyle'
  | 'themeStyle'
  | 'mood'
  | 'technical'
  | 'composition'
  | 'enhancement';

// 简化标签到完整标签的映射结果
export interface ExpandedTag {
  category: TagCategoryKey;
  label: string;        // 中文标签名
  value: string;        // 完整的英文提示词
  displayValue: string; // 详细描述
}

// 标签展开结果
export interface TagExpansionResult {
  fullPrompt: string;          // 完整拼接的提示词
  expandedTags: ExpandedTag[]; // 展开后的标签数组
  warnings: string[];          // 警告信息（找不到的标签）
}

/**
 * 标签映射服务类
 */
export class TagMappingService {
  private static instance: TagMappingService;

  // 标签分类映射
  private readonly tagsByCategory: Record<TagCategoryKey, Tag[]> = {
    artStyle: ART_STYLE_TAGS,
    themeStyle: THEME_STYLE_TAGS,
    mood: MOOD_TAGS,
    technical: TECHNICAL_TAGS,
    composition: COMPOSITION_TAGS,
    enhancement: ENHANCEMENT_TAGS,
  };

  // 简化值到完整标签的快速查找表（懒加载）
  private lookupCache: Map<string, ExpandedTag> | null = null;

  private constructor() {
    // 私有构造函数，确保单例
  }

  static getInstance(): TagMappingService {
    if (!TagMappingService.instance) {
      TagMappingService.instance = new TagMappingService();
    }
    return TagMappingService.instance;
  }

  /**
   * 初始化查找表（第一次使用时构建）
   */
  private initializeLookupCache(): void {
    if (this.lookupCache) return;

    this.lookupCache = new Map();

    // 遍历所有分类的标签，构建查找表
    for (const [category, tags] of Object.entries(this.tagsByCategory)) {
      for (const tag of tags) {
        // 提取简化值（取第一个单词或短语）
        const simpleValue = this.extractSimpleValue(tag.value);

        this.lookupCache.set(simpleValue.toLowerCase(), {
          category: category as TagCategoryKey,
          label: tag.label,
          value: tag.value,
          displayValue: tag.displayValue,
        });

        // 同时支持完整值查找
        this.lookupCache.set(tag.value.toLowerCase(), {
          category: category as TagCategoryKey,
          label: tag.label,
          value: tag.value,
          displayValue: tag.displayValue,
        });
      }
    }
  }

  /**
   * 从完整提示词中提取简化值
   * 例如：'photorealistic, hyperrealistic, professional photography' → 'photorealistic'
   */
  private extractSimpleValue(fullValue: string): string {
    // 取第一个逗号前的内容
    const firstPart = fullValue.split(',')[0].trim();
    return firstPart;
  }

  /**
   * 根据简化标签值查找完整标签定义
   */
  findTagBySimpleValue(simpleValue: string, category?: TagCategoryKey): ExpandedTag | null {
    this.initializeLookupCache();

    const key = simpleValue.toLowerCase().trim();
    const found = this.lookupCache!.get(key);

    // 如果指定了分类，验证是否匹配
    if (found && category && found.category !== category) {
      console.warn(`标签 "${simpleValue}" 在分类 "${category}" 中未找到，但在 "${found.category}" 中存在`);
      return null;
    }

    return found || null;
  }

  /**
   * 根据分类和简化值查找完整提示词
   */
  expandTagValue(category: TagCategoryKey, simpleValue: string): string {
    const tag = this.findTagBySimpleValue(simpleValue, category);
    return tag ? tag.value : simpleValue;
  }

  /**
   * 展开场景包的标签配置为完整提示词
   */
  expandScenePackTags(tags: {
    artStyle?: string;
    themeStyle?: string;
    mood?: string;
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
  }): TagExpansionResult {
    const expandedTags: ExpandedTag[] = [];
    const warnings: string[] = [];
    const promptParts: string[] = [];

    // 处理单选标签（art_style, theme_style, mood）
    const singleSelectionCategories: Array<{ key: TagCategoryKey; value?: string }> = [
      { key: 'artStyle', value: tags.artStyle },
      { key: 'themeStyle', value: tags.themeStyle },
      { key: 'mood', value: tags.mood },
    ];

    for (const { key, value } of singleSelectionCategories) {
      if (!value) continue;

      const expanded = this.findTagBySimpleValue(value, key);
      if (expanded) {
        expandedTags.push(expanded);
        promptParts.push(expanded.value);
      } else {
        warnings.push(`未找到标签: ${key}="${value}"`);
        promptParts.push(value); // 降级：使用原始值
      }
    }

    // 处理多选标签（technical, composition, enhancement）
    const multiSelectionCategories: Array<{ key: TagCategoryKey; values?: string[] }> = [
      { key: 'technical', values: tags.technical },
      { key: 'composition', values: tags.composition },
      { key: 'enhancement', values: tags.enhancement },
    ];

    for (const { key, values } of multiSelectionCategories) {
      if (!values || values.length === 0) continue;

      for (const value of values) {
        const expanded = this.findTagBySimpleValue(value, key);
        if (expanded) {
          expandedTags.push(expanded);
          promptParts.push(expanded.value);
        } else {
          warnings.push(`未找到标签: ${key}="${value}"`);
          promptParts.push(value); // 降级：使用原始值
        }
      }
    }

    return {
      fullPrompt: promptParts.join(', '),
      expandedTags,
      warnings,
    };
  }

  /**
   * 展开数据库模板的标签配置（支持数组格式）
   */
  expandDatabaseTemplateTags(suggestedTags: {
    art_style?: string[];
    theme_style?: string[];
    mood?: string[];
    technical?: string[];
    composition?: string[];
    enhancement?: string[];
  }): TagExpansionResult {
    const expandedTags: ExpandedTag[] = [];
    const warnings: string[] = [];
    const promptParts: string[] = [];

    // 映射数据库字段名到内部分类名
    const categoryMapping: Record<string, TagCategoryKey> = {
      art_style: 'artStyle',
      theme_style: 'themeStyle',
      mood: 'mood',
      technical: 'technical',
      composition: 'composition',
      enhancement: 'enhancement',
    };

    for (const [dbKey, values] of Object.entries(suggestedTags)) {
      const category = categoryMapping[dbKey];
      if (!category || !values || values.length === 0) continue;

      for (const value of values) {
        const expanded = this.findTagBySimpleValue(value, category);
        if (expanded) {
          expandedTags.push(expanded);
          promptParts.push(expanded.value);
        } else {
          warnings.push(`未找到标签: ${dbKey}="${value}"`);
          promptParts.push(value); // 降级：使用原始值
        }
      }
    }

    return {
      fullPrompt: promptParts.join(', '),
      expandedTags,
      warnings,
    };
  }

  /**
   * 构建完整的生成提示词
   *
   * @param basePrompt - 基础描述提示词
   * @param tags - 标签配置
   * @param customModifications - 用户的自定义修改
   */
  buildFullPrompt(
    basePrompt: string,
    tags: Parameters<typeof this.expandScenePackTags>[0],
    customModifications?: string
  ): string {
    const parts: string[] = [];

    // 1. 基础提示词
    if (basePrompt && basePrompt.trim()) {
      parts.push(basePrompt.trim());
    }

    // 2. 展开的标签
    const { fullPrompt, warnings } = this.expandScenePackTags(tags);
    if (fullPrompt) {
      parts.push(fullPrompt);
    }

    // 3. 自定义修改
    if (customModifications && customModifications.trim()) {
      parts.push(customModifications.trim());
    }

    // 输出警告信息到控制台
    if (warnings.length > 0) {
      console.warn('⚠️ 标签映射警告:', warnings);
    }

    return parts.join(', ');
  }

  /**
   * 获取所有可用的标签定义（按分类）
   */
  getAllTags(): Record<TagCategoryKey, Tag[]> {
    return { ...this.tagsByCategory };
  }

  /**
   * 根据分类获取标签列表
   */
  getTagsByCategory(category: TagCategoryKey): Tag[] {
    return this.tagsByCategory[category] || [];
  }

  /**
   * 验证标签值是否存在
   */
  isValidTag(simpleValue: string, category?: TagCategoryKey): boolean {
    return this.findTagBySimpleValue(simpleValue, category) !== null;
  }

  /**
   * 清除缓存（用于测试或热更新）
   */
  clearCache(): void {
    this.lookupCache = null;
  }
}

// 导出单例
export const tagMappingService = TagMappingService.getInstance();
