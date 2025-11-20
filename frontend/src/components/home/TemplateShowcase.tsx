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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [featuredTemplates, setFeaturedTemplates] = useState<SceneTemplate[]>([]);
  const [categorizedTemplates, setCategorizedTemplates] = useState<Map<string, SceneTemplate[]>>(new Map());
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'popular' | 'rating' | 'newest'>('popular');

  const templateService = SceneTemplateService.getInstance();

  // 初始化加载数据
  useEffect(() => {
    loadTemplates();
  }, []);

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

      // 设置分类数据
      setCategories(categoriesData);

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
      await loadCategorizedTemplates(categoriesData);
    } catch (error) {
      console.error('加载模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 按分类加载模板
  const loadCategorizedTemplates = async (categoriesData: CategoryInfo[]) => {
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
    } catch (error) {
      console.error('加载分类模板失败:', error);
    }
  };

  // 切换热门推荐tab
  const handleTabChange = async (tab: 'popular' | 'rating' | 'newest') => {
    setActiveTab(tab);
    try {
      let templates: SceneTemplate[] = [];
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
      setFeaturedTemplates(templates);
    } catch (error) {
      console.error('切换tab失败:', error);
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

        {/* 横向滚动卡片 */}
        <div className="relative">
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {featuredTemplates.map((template) => (
              <div key={template.id} className="flex-shrink-0 w-80 snap-start">
                <TemplateCard
                  template={template}
                  isSelected={selectedTemplateId === template.id}
                  onSelect={onSelectTemplate}
                  variant="featured"
                  showStats={true}
                />
              </div>
            ))}
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
