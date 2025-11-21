/**
 * 分类导航组件
 * 提供分类筛选和切换功能
 */

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getCategoryIcon,
  getCategoryLabel,
  getCategoryDescription,
} from '../../features/ai-models/constants/templateConfig';

export interface CategoryInfo {
  category: string;
  subcategory: string | null;
  count: number;
}

interface CategoryNavigationProps {
  categories: CategoryInfo[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  showAll?: boolean;
}

export function CategoryNavigation({
  categories,
  selectedCategory,
  onCategoryChange,
  showAll = true,
}: CategoryNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // 检查滚动状态
  const checkScrollButtons = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  // 统计主分类数量
  const categoryMap = new Map<string, number>();
  categories.forEach(cat => {
    const count = categoryMap.get(cat.category) || 0;
    categoryMap.set(cat.category, count + cat.count);
  });

  const mainCategories = Array.from(categoryMap.entries()).map(([category, count]) => ({
    category,
    count,
  }));

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, [categories]);

  // 自动滚动效果
  useEffect(() => {
    if (!isAutoScrolling || isPaused || !scrollContainerRef.current || mainCategories.length === 0) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    const buttonWidth = 180; // 估算每个分类按钮宽度
    let scrollPosition = 0;

    const autoScroll = () => {
      if (!scrollContainer || isPaused) return;

      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      if (maxScroll <= 0) return; // 如果内容不需要滚动，退出

      // 平滑滚动到下一个位置
      scrollPosition += buttonWidth;

      // 如果到达末尾，重置到开始
      if (scrollPosition >= maxScroll) {
        scrollPosition = 0;
      }

      scrollContainer.scrollTo({
        left: scrollPosition,
        behavior: 'smooth',
      });

      // 更新滚动按钮状态
      setTimeout(checkScrollButtons, 500);
    };

    // 每6秒自动滚动一次（比精选推荐慢一点，避免同时滚动）
    const interval = setInterval(autoScroll, 6000);

    return () => clearInterval(interval);
  }, [isAutoScrolling, isPaused, mainCategories.length]);

  // 滚动函数
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = 300;
    const newScrollLeft = direction === 'left'
      ? scrollContainerRef.current.scrollLeft - scrollAmount
      : scrollContainerRef.current.scrollLeft + scrollAmount;

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });

    setTimeout(checkScrollButtons, 300);
  };

  return (
    <div className="relative">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">浏览分类</h3>
          <p className="text-sm text-gray-600 mt-1">
            {mainCategories.length} 个分类，共 {categories.reduce((sum, c) => sum + c.count, 0)} 个模板
          </p>
        </div>
      </div>

      {/* 导航容器 */}
      <div className="relative group">
        {/* 左侧滚动按钮 */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all duration-200 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0"
            aria-label="向左滚动"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* 滚动容器 */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollButtons}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* 全部分类按钮 */}
          {showAll && (
            <CategoryButton
              category="all"
              count={categories.reduce((sum, c) => sum + c.count, 0)}
              isSelected={selectedCategory === 'all'}
              onClick={() => onCategoryChange('all')}
            />
          )}

          {/* 分类按钮列表 */}
          {mainCategories.map(({ category, count }) => (
            <CategoryButton
              key={category}
              category={category}
              count={count}
              isSelected={selectedCategory === category}
              onClick={() => onCategoryChange(category)}
            />
          ))}
        </div>

        {/* 右侧滚动按钮 */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:shadow-xl transition-all duration-200 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
            aria-label="向右滚动"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* 左侧渐变遮罩 */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none" />
        )}

        {/* 右侧渐变遮罩 */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
        )}
      </div>

      {/* 添加CSS隐藏滚动条 */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

// 分类按钮组件
interface CategoryButtonProps {
  category: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

function CategoryButton({ category, count, isSelected, onClick }: CategoryButtonProps) {
  const icon = getCategoryIcon(category);
  const label = getCategoryLabel(category);
  const description = getCategoryDescription(category);

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 group relative px-6 py-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
        isSelected
          ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-transparent text-white shadow-lg shadow-purple-200'
          : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:shadow-md'
      }`}
      title={description}
    >
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div className={`text-2xl transition-transform duration-300 ${
          isSelected ? 'scale-110' : 'group-hover:scale-110'
        }`}>
          {icon}
        </div>

        {/* 文字信息 */}
        <div className="text-left">
          <div className={`font-semibold whitespace-nowrap ${
            isSelected ? 'text-white' : 'text-gray-900 group-hover:text-purple-600'
          }`}>
            {label}
          </div>
          <div className={`text-xs mt-0.5 ${
            isSelected ? 'text-purple-100' : 'text-gray-500'
          }`}>
            {count} 个模板
          </div>
        </div>
      </div>

      {/* 选中指示器 */}
      {isSelected && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg" />
      )}
    </button>
  );
}
