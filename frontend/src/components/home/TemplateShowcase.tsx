/**
 * 模板展示主组件
 * 整合所有模板展示功能，包括热门推荐、分类导航、分类展示
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, Star, Clock, Search } from 'lucide-react';
import { TemplateCard } from './TemplateCard';
import { CategoryNavigation, type CategoryInfo } from './CategoryNavigation';
import { CategorySection } from './CategorySection';
import type { SceneTemplate } from '../../types/database';
import { SceneTemplateService } from '../../services/business';
import { DEFAULT_LIMITS } from '../../features/ai-models/constants/templateConfig';

interface TemplateShowcaseProps {
  onSelectTemplate: (template: SceneTemplate) => void;
  selectedTemplateId?: string;
}

export function TemplateShowcase({
  onSelectTemplate,
  selectedTemplateId,
}: TemplateShowcaseProps) {
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [featuredTemplates, setFeaturedTemplates] = useState<SceneTemplate[]>([]);
  const [categorizedTemplates, setCategorizedTemplates] = useState<Map<string, SceneTemplate[]>>(new Map());
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'popular' | 'rating' | 'newest'>('popular');

  // 缓存三种排序的模板数据
  const [cachedTemplates, setCachedTemplates] = useState<{
    popular: SceneTemplate[];
    rating: SceneTemplate[];
    newest: SceneTemplate[];
  }>({
    popular: [],
    rating: [],
    newest: [],
  });

  // 收藏状态缓存
  const [favoriteStatusMap, setFavoriteStatusMap] = useState<Map<string, boolean>>(new Map());

  // 自动滚动相关状态
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const scrollSpeedRef = React.useRef(1.5); // 每帧滚动像素数（调整可改变速度）

  const templateService = SceneTemplateService.getInstance();

  // 初始化加载数据
  useEffect(() => {
    loadTemplates();
  }, []);

  // 连续自动滚动效果（类似弹幕）
  useEffect(() => {
    console.log('🔄 滚动 Effect 触发:', {
      isAutoScrolling,
      templateCount: featuredTemplates.length,
      isPaused,
    });

    // 只检查基本条件，不检查 ref（因为 DOM 可能还没渲染）
    if (!isAutoScrolling || featuredTemplates.length === 0) {
      console.log('❌ 滚动条件不满足，跳过');
      return;
    }

    let lastTimestamp = 0;

    // 添加一个延迟，确保 DOM 完全渲染
    const startDelay = setTimeout(() => {
      const scrollContainer = scrollContainerRef.current;

      // 在延迟后检查 ref 是否存在
      if (!scrollContainer) {
        console.error('⚠️ 滚动容器未找到，DOM 可能还未渲染');
        return;
      }

      console.log('✅ 开始启动滚动动画');

      // 检查滚动容器的尺寸
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      console.log('📏 容器尺寸:', { scrollWidth, clientWidth, halfWidth: (scrollWidth - clientWidth) / 2 });

      const smoothScroll = (timestamp: number) => {
        if (!scrollContainer) return;

        // 计算时间差（用于平滑滚动）
        if (!lastTimestamp) lastTimestamp = timestamp;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // 如果未暂停，继续滚动
        if (!isPaused) {
          const currentScroll = scrollContainer.scrollLeft;
          const scrollWidth = scrollContainer.scrollWidth;
          const clientWidth = scrollContainer.clientWidth;

          // 计算真实内容宽度（一半，因为我们复制了内容）
          const halfWidth = (scrollWidth - clientWidth) / 2;

          // 只有当有可滚动内容时才执行滚动逻辑
          if (halfWidth > 0) {
            // 增加滚动位置
            let newScroll = currentScroll + scrollSpeedRef.current;

            // 无缝循环：当滚动到复制内容的一半时，重置到开始
            if (newScroll >= halfWidth) {
              newScroll = 0;
            }

            scrollContainer.scrollLeft = newScroll;
          }
        }

        // 继续下一帧
        animationFrameRef.current = requestAnimationFrame(smoothScroll);
      };

      // 开始动画
      animationFrameRef.current = requestAnimationFrame(smoothScroll);
    }, 500); // 增加延迟到500ms

    // 清理函数
    return () => {
      console.log('🧹 清理滚动动画');
      clearTimeout(startDelay);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAutoScrolling, isPaused, featuredTemplates]);

  // 加载模板数据
  const loadTemplates = async () => {
    setLoading(true);
    try {
      // 并行加载所有数据
      const [categoriesData, popularTemplates, topRatedTemplates, latestTemplates] = await Promise.all([
        templateService.getCategories(),
        templateService.getPopularTemplates(DEFAULT_LIMITS.FEATURED),
        templateService.getTopRatedTemplates(DEFAULT_LIMITS.FEATURED),
        templateService.getLatestTemplates(DEFAULT_LIMITS.FEATURED),
      ]);

      console.log('加载的模板数据:', {
        popular: popularTemplates.length,
        rating: topRatedTemplates.length,
        newest: latestTemplates.length,
        popularIds: popularTemplates.slice(0, 3).map(t => ({ id: t.id, name: t.name, usage: t.usage_count })),
        ratingIds: topRatedTemplates.slice(0, 3).map(t => ({ id: t.id, name: t.name, rating: t.rating })),
        newestIds: latestTemplates.slice(0, 3).map(t => ({ id: t.id, name: t.name, created: t.created_at })),
      });

      // 设置分类数据
      setCategories(categoriesData);

      // 缓存所有三种排序的数据
      setCachedTemplates({
        popular: popularTemplates,
        rating: topRatedTemplates,
        newest: latestTemplates,
      });

      // 根据当前tab设置热门推荐
      switch (activeTab) {
        case 'popular':
          setFeaturedTemplates(popularTemplates);
          break;
        case 'rating':
          setFeaturedTemplates(topRatedTemplates);
          break;
        case 'newest':
          setFeaturedTemplates(latestTemplates);
          break;
      }

      // 按分类加载模板
      const categoryTemplatesMap = await loadCategorizedTemplates(categoriesData);

      // 批量查询所有模板的收藏状态（包括精选推荐和分类模板，一次性查询）
      const allTemplateIds = new Set<string>();

      // 添加精选推荐的模板 ID
      popularTemplates.forEach(t => allTemplateIds.add(t.id));
      topRatedTemplates.forEach(t => allTemplateIds.add(t.id));
      latestTemplates.forEach(t => allTemplateIds.add(t.id));

      // 添加所有分类模板的 ID
      categoryTemplatesMap.forEach(templates => {
        templates.forEach(t => allTemplateIds.add(t.id));
      });

      console.log(`📊 批量查询 ${allTemplateIds.size} 个模板的收藏状态`);
      const favoriteMap = await templateService.getBatchFavoriteStatus(Array.from(allTemplateIds));
      setFavoriteStatusMap(favoriteMap);
    } catch (error) {
      console.error('加载模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 按分类加载模板
  const loadCategorizedTemplates = async (categoriesData: CategoryInfo[]): Promise<Map<string, SceneTemplate[]>> => {
    try {
      // 统计主分类
      const categoryMap = new Map<string, number>();
      categoriesData.forEach(cat => {
        const count = categoryMap.get(cat.category) || 0;
        categoryMap.set(cat.category, count + cat.count);
      });

      // 获取前N个分类
      const mainCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1]) // 按数量排序
        .slice(0, DEFAULT_LIMITS.MAX_CATEGORIES)
        .map(([category]) => category);

      // 为每个分类加载模板
      const templateMap = new Map<string, SceneTemplate[]>();
      await Promise.all(
        mainCategories.map(async (category) => {
          const templates = await templateService.getTemplatesByCategory(
            category,
            undefined,
            'popular'
          );
          templateMap.set(category, templates);
        })
      );

      setCategorizedTemplates(templateMap);
      return templateMap; // 返回 templateMap 用于批量查询收藏状态
    } catch (error) {
      console.error('加载分类模板失败:', error);
      return new Map(); // 发生错误时返回空 Map
    }
  };

  // 切换热门推荐tab
  const handleTabChange = async (tab: 'popular' | 'rating' | 'newest') => {
    if (tab === activeTab) return; // 避免重复点击

    setActiveTab(tab);
    setTabLoading(true);

    try {
      let templates: SceneTemplate[] = [];

      // 优先使用缓存数据
      if (cachedTemplates[tab].length > 0) {
        console.log(`使用缓存的 ${tab} 数据:`, cachedTemplates[tab].slice(0, 3).map(t => t.name));
        templates = cachedTemplates[tab];
      } else {
        // 如果缓存为空，重新加载
        console.log(`缓存为空，重新加载 ${tab} 数据`);
        switch (tab) {
          case 'popular':
            templates = await templateService.getPopularTemplates(DEFAULT_LIMITS.FEATURED);
            break;
          case 'rating':
            templates = await templateService.getTopRatedTemplates(DEFAULT_LIMITS.FEATURED);
            break;
          case 'newest':
            templates = await templateService.getLatestTemplates(DEFAULT_LIMITS.FEATURED);
            break;
        }

        // 更新缓存
        setCachedTemplates(prev => ({
          ...prev,
          [tab]: templates,
        }));
      }

      console.log(`切换到 ${tab} tab，显示 ${templates.length} 个模板`);
      setFeaturedTemplates(templates);
    } catch (error) {
      console.error('切换tab失败:', error);
    } finally {
      setTabLoading(false);
    }
  };

  // 切换分类
  const handleCategoryChange = async (category: string) => {
    setSelectedCategory(category);
    // 如果是"全部"，不需要额外操作
    // 如果是具体分类，确保已加载该分类的模板
    if (category !== 'all' && !categorizedTemplates.has(category)) {
      try {
        const templates = await templateService.getTemplatesByCategory(category);
        setCategorizedTemplates(new Map(categorizedTemplates).set(category, templates));
      } catch (error) {
        console.error('加载分类模板失败:', error);
      }
    }
  };

  // 处理收藏状态变化
  const handleFavoriteChange = (templateId: string, isFavorited: boolean) => {
    setFavoriteStatusMap(prev => {
      const newMap = new Map(prev);
      newMap.set(templateId, isFavorited);
      return newMap;
    });
  };

  // 处理查看全部
  const handleViewAll = (category: string) => {
    setSelectedCategory(category);
    // 滚动到分类区域
    setTimeout(() => {
      const element = document.getElementById(`category-${category}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 骨架屏
  if (loading) {
    return <LoadingSkeleton />;
  }

  // 根据选中分类过滤要显示的分类
  const displayCategories = selectedCategory === 'all'
    ? Array.from(categorizedTemplates.keys())
    : [selectedCategory];

  return (
    <div className="space-y-12 animate-fade-in">
      {/* 热门推荐区 */}
      <section className="space-y-6">
        {/* 标题和tab切换 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span>精选推荐</span>
            </h2>
            <p className="text-gray-600 mt-2 ml-13">
              最受欢迎的专业模板，助您快速开始创作
            </p>
          </div>

          {/* Tab切换 */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <TabButton
              icon={<Flame className="w-4 h-4" />}
              label="最热门"
              active={activeTab === 'popular'}
              onClick={() => handleTabChange('popular')}
            />
            <TabButton
              icon={<Star className="w-4 h-4" />}
              label="最高分"
              active={activeTab === 'rating'}
              onClick={() => handleTabChange('rating')}
            />
            <TabButton
              icon={<Clock className="w-4 h-4" />}
              label="最新"
              active={activeTab === 'newest'}
              onClick={() => handleTabChange('newest')}
            />
          </div>
        </div>

        {/* 横向滚动卡片 - 无限循环效果 */}
        <div className="relative group">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollBehavior: 'auto' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* 原始内容 */}
            {featuredTemplates.map((template) => (
              <div key={`original-${template.id}`} className="flex-shrink-0 w-80">
                <TemplateCard
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={onSelectTemplate}
                  variant="featured"
                  showStats={true}
                  initialFavoriteStatus={favoriteStatusMap.get(template.id)}
                  onFavoriteChange={handleFavoriteChange}
                />
              </div>
            ))}
            {/* 复制内容（用于无缝循环） */}
            {featuredTemplates.map((template) => (
              <div key={`duplicate-${template.id}`} className="flex-shrink-0 w-80">
                <TemplateCard
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={onSelectTemplate}
                  variant="featured"
                  showStats={true}
                  initialFavoriteStatus={favoriteStatusMap.get(template.id)}
                  onFavoriteChange={handleFavoriteChange}
                />
              </div>
            ))}
          </div>

          {/* 加载遮罩 */}
          {tabLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
              <div className="flex items-center gap-2 text-purple-600">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">加载中...</span>
              </div>
            </div>
          )}

          {/* 自动滚动指示器 */}
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {isPaused ? (
              <>
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                <span>已暂停</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span>自动轮播中</span>
              </>
            )}
          </div>

          {/* 左右渐变遮罩 */}
          <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* 分类导航 */}
      <CategoryNavigation
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* 分类展示区 */}
      <div className="space-y-16">
        {displayCategories.map((category) => {
          const templates = categorizedTemplates.get(category) || [];
          return (
            <div key={category} id={`category-${category}`}>
              <CategorySection
                category={category}
                templates={templates}
                onSelectTemplate={onSelectTemplate}
                selectedTemplateId={selectedTemplateId}
                initialExpanded={selectedCategory === category}
                showViewAll={selectedCategory === 'all'}
                onViewAll={handleViewAll}
                previewCount={selectedCategory === 'all' ? 3 : 12}
                favoriteStatusMap={favoriteStatusMap}
                onFavoriteChange={handleFavoriteChange}
              />
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {displayCategories.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无模板</h3>
          <p className="text-gray-600">
            该分类下还没有模板，敬请期待！
          </p>
        </div>
      )}

      {/* 隐藏滚动条的样式 */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

// Tab按钮组件
interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-white text-purple-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// 加载骨架屏
function LoadingSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      {/* 热门推荐骨架 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 bg-gray-200 rounded-lg"></div>
          <div className="h-10 w-64 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="flex gap-6 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80">
              <div className="bg-gray-200 rounded-xl h-96"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 分类导航骨架 */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-gray-200 rounded"></div>
        <div className="flex gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 w-40 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>

      {/* 分类模板骨架 */}
      {[...Array(2)].map((_, i) => (
        <div key={i} className="space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="bg-gray-200 rounded-xl h-80"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
