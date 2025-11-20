/**
 * 模板卡片组件
 * 展示单个场景模板的信息和操作
 */

import React, { useState, useEffect } from 'react';
import { Heart, Zap, ThumbsUp, TrendingUp } from 'lucide-react';
import type { SceneTemplate } from '../../types/database';
import { SceneTemplateService } from '../../services/business';
import {
  getCategoryGradient,
  getCategoryIcon,
  getCategoryLabel,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
} from '../../features/ai-models/constants/templateConfig';

interface TemplateCardProps {
  template: SceneTemplate;
  isSelected?: boolean;
  onSelect: (template: SceneTemplate) => void;
  variant?: 'default' | 'compact' | 'featured';
  showStats?: boolean;
}

export function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  variant = 'default',
  showStats = true,
}: TemplateCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const templateService = SceneTemplateService.getInstance();

  // 检查是否已收藏
  useEffect(() => {
    const checkFavorite = async () => {
      try {
        const favorited = await templateService.isTemplateFavorited(template.id);
        setIsFavorited(favorited);
      } catch (error) {
        // 用户未登录，忽略错误
        setIsFavorited(false);
      }
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

  // 处理点击
  const handleClick = () => {
    onSelect(template);
  };

  // 根据变体调整样式
  const getCardClasses = () => {
    const baseClasses = 'relative group cursor-pointer transition-all duration-300 rounded-xl border-2 overflow-hidden bg-white';

    if (variant === 'featured') {
      return `${baseClasses} ${
        isSelected
          ? 'border-purple-500 shadow-2xl shadow-purple-200 scale-105'
          : 'border-gray-200 hover:border-purple-300 hover:shadow-2xl hover:scale-105 hover:-translate-y-2'
      }`;
    }

    if (variant === 'compact') {
      return `${baseClasses} ${
        isSelected
          ? 'border-purple-500 shadow-lg'
          : 'border-gray-200 hover:border-purple-300 hover:shadow-lg'
      }`;
    }

    return `${baseClasses} ${
      isSelected
        ? 'border-purple-500 shadow-xl shadow-purple-100 scale-102'
        : 'border-gray-200 hover:border-purple-300 hover:shadow-xl hover:-translate-y-1'
    }`;
  };

  // 获取渐变背景
  const gradientClass = getCategoryGradient(template.category);
  const categoryIcon = getCategoryIcon(template.category);
  const categoryLabel = getCategoryLabel(template.category);
  const difficultyConfig = DIFFICULTY_COLORS[template.difficulty];

  return (
    <div
      className={getCardClasses()}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-video overflow-hidden">
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center transition-all duration-500 group-hover:scale-110`}>
            <div className="text-center transform transition-transform duration-300 group-hover:scale-110">
              <div className="text-6xl mb-2 animate-pulse">{categoryIcon}</div>
              <div className="text-white text-sm font-medium opacity-90">
                {categoryLabel}
              </div>
            </div>
          </div>
        )}

        {/* 悬浮遮罩层 */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white text-sm line-clamp-2 mb-2">
              {template.base_prompt}
            </p>
            <button className="w-full bg-white/90 hover:bg-white text-gray-900 py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              <span>立即使用</span>
            </button>
          </div>
        </div>

        {/* 收藏按钮 */}
        <button
          onClick={toggleFavorite}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white backdrop-blur-sm transition-all duration-200 shadow-lg z-10 transform hover:scale-110 active:scale-95"
          title={isFavorited ? '取消收藏' : '收藏'}
        >
          <Heart
            className={`w-5 h-5 transition-all duration-200 ${
              isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'
            }`}
          />
        </button>

        {/* 官方标签 */}
        {template.is_official && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg">
            官方推荐
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-3">
        {/* 标题 */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>

        {/* 标签组 */}
        <div className="flex flex-wrap gap-2">
          {/* 分类标签 */}
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-700 font-medium">
            <span>{categoryIcon}</span>
            <span>{categoryLabel}</span>
          </span>

          {/* 难度标签 */}
          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-md font-medium ${difficultyConfig.bg} ${difficultyConfig.text}`}>
            {DIFFICULTY_LABELS[template.difficulty]}
          </span>
        </div>

        {/* 统计信息 */}
        {showStats && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              {/* 评分 */}
              <div className="flex items-center gap-1" title="评分">
                <span className="text-yellow-500">⭐</span>
                <span className="font-medium">{template.rating.toFixed(1)}</span>
              </div>

              {/* 点赞数 */}
              <div className="flex items-center gap-1" title="点赞数">
                <ThumbsUp className="w-3 h-3" />
                <span className="font-medium">{template.likes_count}</span>
              </div>

              {/* 使用次数 */}
              <div className="flex items-center gap-1" title="使用次数">
                <TrendingUp className="w-3 h-3" />
                <span className="font-medium">{template.usage_count}</span>
              </div>
            </div>

            {/* 使用按钮（紧凑模式） */}
            {variant === 'compact' && (
              <button className="text-purple-600 hover:text-purple-700 text-xs font-medium transition-colors">
                使用 →
              </button>
            )}
          </div>
        )}
      </div>

      {/* 选中状态指示器 */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-purple-500/5"></div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-blue-600"></div>
        </div>
      )}
    </div>
  );
}
