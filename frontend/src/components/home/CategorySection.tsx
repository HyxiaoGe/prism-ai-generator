/**
 * 分类区域组件
 * 展示单个分类下的模板列表，支持折叠/展开
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { TemplateCard } from './TemplateCard';
import type { SceneTemplate } from '../../types/database';
import {
  getCategoryIcon,
  getCategoryLabel,
  getCategoryDescription,
} from '../../features/ai-models/constants/templateConfig';

interface CategorySectionProps {
  category: string;
  templates: SceneTemplate[];
  onSelectTemplate: (template: SceneTemplate) => void;
  selectedTemplateId?: string;
  initialExpanded?: boolean;
  showViewAll?: boolean;
  onViewAll?: (category: string) => void;
  previewCount?: number;
  favoriteStatusMap?: Map<string, boolean>; // 收藏状态缓存
  onFavoriteChange?: (templateId: string, isFavorited: boolean) => void; // 收藏状态变化回调
}

export function CategorySection({
  category,
  templates,
  onSelectTemplate,
  selectedTemplateId,
  initialExpanded = true,
  showViewAll = true,
  onViewAll,
  previewCount = 3,
  favoriteStatusMap,
  onFavoriteChange,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const categoryIcon = getCategoryIcon(category);
  const categoryLabel = getCategoryLabel(category);
  const categoryDescription = getCategoryDescription(category);

  // 显示的模板（预览或全部）
  const displayedTemplates = isExpanded ? templates : templates.slice(0, previewCount);
  const hasMore = templates.length > previewCount;

  if (templates.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6 animate-fade-in">
      {/* 分类标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* 图标和标题 */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-2xl">
              {categoryIcon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {categoryLabel}
                <span className="text-sm font-normal text-gray-500">
                  ({templates.length})
                </span>
              </h3>
              {categoryDescription && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {categoryDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {/* 查看全部按钮 */}
          {showViewAll && onViewAll && (
            <button
              onClick={() => onViewAll(category)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <span>查看全部</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {/* 折叠/展开按钮 */}
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200"
            >
              <span>{isExpanded ? '收起' : '展开更多'}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 模板网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onSelect={onSelectTemplate}
            variant="default"
            showStats={true}
            initialFavoriteStatus={favoriteStatusMap?.get(template.id)}
            onFavoriteChange={onFavoriteChange}
          />
        ))}
      </div>

      {/* 折叠状态下的"查看更多"提示 */}
      {!isExpanded && hasMore && (
        <div className="text-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            <span>还有 {templates.length - previewCount} 个模板</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
