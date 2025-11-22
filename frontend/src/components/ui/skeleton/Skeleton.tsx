/**
 * 骨架屏基础组件
 * 用于显示加载状态的占位符动画
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  // 根据变体设置默认样式
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  // 动画类
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  };

  // 默认尺寸
  const defaultHeight = variant === 'text' ? '1rem' : '100%';

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || defaultHeight,
  };

  return (
    <div
      className={`bg-gray-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-label="加载中..."
    />
  );
};

/**
 * 模板卡片骨架屏
 */
export const TemplateCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 border border-gray-100">
      {/* 图片骨架 */}
      <Skeleton variant="rectangular" height="12rem" className="w-full" />

      {/* 内容骨架 */}
      <div className="p-4 space-y-3">
        {/* 标题 */}
        <Skeleton variant="text" height="1.5rem" width="80%" />

        {/* 描述 */}
        <div className="space-y-2">
          <Skeleton variant="text" height="0.875rem" width="100%" />
          <Skeleton variant="text" height="0.875rem" width="60%" />
        </div>

        {/* 底部信息 */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton variant="circular" width="2rem" height="2rem" />
          <Skeleton variant="text" height="0.75rem" width="4rem" />
        </div>
      </div>
    </div>
  );
};

/**
 * 图片网格骨架屏
 */
export const ImageGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl overflow-hidden shadow-sm">
          {/* 图片骨架 */}
          <Skeleton variant="rectangular" height="16rem" className="w-full" />

          {/* 信息骨架 */}
          <div className="p-4 space-y-2">
            <Skeleton variant="text" height="1rem" width="70%" />
            <Skeleton variant="text" height="0.75rem" width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 模板展示骨架屏
 */
export const TemplateShowcaseSkeleton: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Tab 骨架 */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" width="8rem" height="2.5rem" />
        ))}
      </div>

      {/* 轮播区域骨架 */}
      <div className="space-y-4">
        <Skeleton variant="text" height="1.5rem" width="12rem" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* 分类区域骨架 */}
      <div className="space-y-4">
        <Skeleton variant="text" height="1.5rem" width="10rem" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};
