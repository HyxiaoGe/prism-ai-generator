/**
 * 场景模板浏览器组件
 * 提供模板浏览、搜索、筛选、收藏等功能
 */

import React, { useState, useEffect } from 'react';
import { SceneTemplateService } from '../../../services/business';
import type { SceneTemplate } from '../../../types/database';
import type { TemplateSortBy } from '../../../repositories';

// 分类标签映射
const CATEGORY_LABELS: Record<string, string> = {
  portrait: '人像摄影',
  landscape: '风景摄影',
  product: '产品摄影',
  architecture: '建筑摄影',
  food: '美食摄影',
  fashion: '时尚摄影',
  wildlife: '野生动物',
  abstract: '抽象艺术',
  fantasy: '奇幻场景',
  scifi: '科幻场景',
  all: '全部模板',
};

// 难度标签映射
const DIFFICULTY_LABELS = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

interface SceneTemplateBrowserProps {
  onSelectTemplate: (template: SceneTemplate) => void;
  selectedTemplateId?: string;
}

export function SceneTemplateBrowser({
  onSelectTemplate,
  selectedTemplateId,
}: SceneTemplateBrowserProps) {
  const [templates, setTemplates] = useState<SceneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TemplateSortBy>('popular');
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);

  const templateService = SceneTemplateService.getInstance();

  // 加载分类列表
  useEffect(() => {
    const loadCategories = async () => {
      const categoriesData = await templateService.getCategories();

      // 统计每个主分类的数量
      const categoryMap = new Map<string, number>();
      categoriesData.forEach(cat => {
        const count = categoryMap.get(cat.category) || 0;
        categoryMap.set(cat.category, count + cat.count);
      });

      const categoryList = Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count,
      }));

      setCategories(categoryList);
    };

    loadCategories();
  }, []);

  // 加载模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        let result: SceneTemplate[];

        if (searchQuery.trim()) {
          // 搜索模式
          result = await templateService.searchTemplates(searchQuery);
        } else if (selectedCategory === 'all') {
          // 全部模板
          result = await templateService.getAllTemplates(sortBy);
        } else {
          // 按分类筛选
          result = await templateService.getTemplatesByCategory(selectedCategory, undefined, sortBy);
        }

        setTemplates(result);
      } catch (error) {
        console.error('加载模板失败:', error);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        {/* 搜索框 */}
        <div className="flex-1 w-full md:w-auto">
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* 排序选择 */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as TemplateSortBy)}
          className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
        >
          <option value="popular">最热门</option>
          <option value="rating">最高分</option>
          <option value="newest">最新</option>
          <option value="usage">使用最多</option>
        </select>
      </div>

      {/* 分类导航 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-violet-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {CATEGORY_LABELS.all}
        </button>
        {categories.map(({ category, count }) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === category
                ? 'bg-violet-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[category] || category} ({count})
          </button>
        ))}
      </div>

      {/* 模板网格 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">
            {searchQuery ? '未找到匹配的模板' : '暂无模板'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={() => onSelectTemplate(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 模板卡片组件
interface TemplateCardProps {
  template: SceneTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const templateService = SceneTemplateService.getInstance();

  // 检查是否已收藏
  useEffect(() => {
    const checkFavorite = async () => {
      const favorited = await templateService.isTemplateFavorited(template.id);
      setIsFavorited(favorited);
    };
    checkFavorite();
  }, [template.id]);

  // 切换收藏状态
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isFavorited) {
        await templateService.unfavoriteTemplate(template.id);
        setIsFavorited(false);
      } else {
        await templateService.favoriteTemplate(template.id);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('切换收藏状态失败:', error);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-violet-500 bg-violet-50 shadow-lg'
          : 'border-gray-200 bg-white hover:border-violet-300 hover:shadow-md'
      }`}
    >
      {/* 收藏按钮 */}
      <button
        onClick={toggleFavorite}
        className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-all"
        title={isFavorited ? '取消收藏' : '收藏'}
      >
        <span className={`text-lg ${isFavorited ? 'text-red-500' : 'text-gray-400'}`}>
          {isFavorited ? '❤️' : '🤍'}
        </span>
      </button>

      {/* 模板信息 */}
      <div className="space-y-2 pr-10">
        {/* 标题和标签 */}
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900">{template.name}</h3>
        </div>

        {/* 难度和分类 */}
        <div className="flex gap-2 flex-wrap">
          <span className="inline-block px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700">
            {CATEGORY_LABELS[template.category] || template.category}
          </span>
          <span className="inline-block px-2 py-1 text-xs rounded-md bg-green-100 text-green-700">
            {DIFFICULTY_LABELS[template.difficulty]}
          </span>
          {template.is_official && (
            <span className="inline-block px-2 py-1 text-xs rounded-md bg-purple-100 text-purple-700">
              官方
            </span>
          )}
        </div>

        {/* 描述 */}
        {template.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
        )}

        {/* 提示词预览 */}
        <p className="text-xs text-gray-500 line-clamp-1 font-mono">
          {template.base_prompt}
        </p>

        {/* 统计信息 */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            ⭐ {template.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            👍 {template.likes_count}
          </span>
          <span className="flex items-center gap-1">
            🔥 {template.usage_count}次使用
          </span>
        </div>
      </div>
    </div>
  );
}
