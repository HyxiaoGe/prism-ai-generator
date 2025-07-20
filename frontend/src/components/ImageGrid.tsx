import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Heart, Share2, Maximize2, Copy, Trash2, Sparkles, Clock, Image, ChevronDown, ChevronUp, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import { parsePromptFeatures } from '../features/ai-models/utils/promptParser';
import { DatabaseService } from '../services/database';
import type { GenerationResult } from '../types';

interface ImageGridProps {
  viewMode: 'grid' | 'masonry';
  onRegenerate?: (batch: any) => void; // 新增：重新生成回调（批次级别）
}

// 🚀 新增：懒加载图片组件
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onClick?: (e?: React.MouseEvent<HTMLImageElement>) => void;
  style?: React.CSSProperties;
  priority?: boolean; // 高优先级图片立即加载（如弹窗预览）
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, onLoad, onClick, style, priority = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority); // 高优先级图片直接视为在视口内
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // 🔍 Intersection Observer 监控图片是否进入视口（仅对非优先级图片生效）
  useEffect(() => {
    if (priority) return; // 高优先级图片跳过观察器

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.1
      }
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }

    return () => {
      if (placeholderRef.current) {
        observer.unobserve(placeholderRef.current);
      }
    };
  }, [priority]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  return (
    <div ref={placeholderRef} className="relative w-full h-full" style={style}>
      {/* 占位符 - 在图片加载前显示 */}
      {!isLoaded && (
        <div className={`${className} bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border border-gray-200/50`}>
          <div className="flex flex-col items-center justify-center p-4">
            {isInView ? (
              <>
                {/* 加载动画 */}
                <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin mb-2"></div>
                <span className="text-xs text-gray-500 font-medium">加载中...</span>
              </>
            ) : (
              <>
                {/* 未进入视口时的图标 */}
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                  <Image className="w-6 h-6 text-gray-400" />
                </div>
                <span className="text-xs text-gray-400 font-medium">即将加载</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 实际图片 - 只有进入视口才开始加载 */}
      {isInView && (
        <>
          {hasError ? (
            // 加载失败时的占位符
            <div className={`${className} bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center border border-red-200/50`}>
              <div className="flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="w-6 h-6 text-red-400" />
                </div>
                <span className="text-xs text-red-600 font-medium">加载失败</span>
                <span className="text-xs text-gray-500 mt-1">请使用重新生成按钮</span>
              </div>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              onClick={onClick}
              style={{ display: isLoaded ? 'block' : 'none' }}
            />
          )}
        </>
      )}
    </div>
  );
};

export function ImageGrid({ viewMode, onRegenerate }: ImageGridProps) {
  const { generationBatches, removeBatch, updateImageFeedback } = useAIGenerationStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [collapsedBatches, setCollapsedBatches] = useState<Set<string>>(new Set());
  const [imageHeights, setImageHeights] = useState<Record<string, number>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  // 计算瀑布流列数
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 3;
    const width = window.innerWidth;
    if (width < 768) return 2;
    if (width < 1200) return 3;
    if (width < 1600) return 4;
    return 5;
  };

  const [columnCount, setColumnCount] = useState(getColumnCount);

  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取当前批次的图片列表
  const getCurrentBatchImages = () => {
    if (!selectedBatchId) return [];
    const currentBatch = generationBatches.find(batch => batch.id === selectedBatchId);
    return currentBatch?.results || [];
  };

  // 获取当前选中图片在当前批次中的索引
  const getCurrentImageIndex = () => {
    if (!selectedImage || !selectedBatchId) return -1;
    const currentBatchImages = getCurrentBatchImages();
    return currentBatchImages.findIndex(img => img.imageUrl === selectedImage);
  };

  // 切换到上一张图片（当前批次内）
  const goToPrevious = () => {
    const currentBatchImages = getCurrentBatchImages();
    const currentIndex = getCurrentImageIndex();
    if (currentIndex > 0) {
      setSelectedImage(currentBatchImages[currentIndex - 1].imageUrl);
    }
  };

  // 切换到下一张图片（当前批次内）
  const goToNext = () => {
    const currentBatchImages = getCurrentBatchImages();
    const currentIndex = getCurrentImageIndex();
    if (currentIndex < currentBatchImages.length - 1) {
      setSelectedImage(currentBatchImages[currentIndex + 1].imageUrl);
    }
  };

  // 处理图片点击，设置选中的图片和批次
  const handleImageClick = (imageUrl: string, batchId: string) => {
    setSelectedImage(imageUrl);
    setSelectedBatchId(batchId);
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedImage(null);
        setSelectedBatchId(null);
      }
    };

    if (selectedImage) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [selectedImage, selectedBatchId]);

  // 处理图像加载，记录高度
  const handleImageLoad = (imageUrl: string, height: number) => {
    setImageHeights(prev => ({
      ...prev,
      [imageUrl]: height
    }));
  };

  // 切换批次折叠状态
  const toggleBatchCollapse = (batchId: string) => {
    setCollapsedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 瀑布流布局计算（针对单个批次内的图片）
  const getMasonryStyle = (batchResults: any[], index: number) => {
    if (viewMode !== 'masonry') return {};

    const columnIndex = index % columnCount;
    const rowIndex = Math.floor(index / columnCount);

    // 计算每列的累计高度
    let columnHeight = 0;
    for (let i = 0; i < rowIndex; i++) {
      const itemIndex = i * columnCount + columnIndex;
      if (itemIndex < batchResults.length) {
        const imageUrl = batchResults[itemIndex].imageUrl;
        columnHeight += (imageHeights[imageUrl] || 320) + 24;
      }
    }

    return {
      position: 'absolute' as const,
      left: `${(columnIndex * 100) / columnCount}%`,
      top: `${columnHeight}px`,
      width: `calc(${100 / columnCount}% - 12px)`,
      marginLeft: columnIndex === 0 ? '0' : '6px',
      marginRight: columnIndex === columnCount - 1 ? '0' : '6px',
    };
  };

  // 计算批次内瀑布流容器高度
  const getBatchMasonryHeight = (batchResults: any[]) => {
    if (viewMode !== 'masonry' || batchResults.length === 0) return 'auto';

    const columnHeights = Array(columnCount).fill(0);
    
    batchResults.forEach((item: any, index: number) => {
      const columnIndex = index % columnCount;
      const imageHeight = imageHeights[item.imageUrl] || 320;
      columnHeights[columnIndex] += imageHeight + 24;
    });

    return `${Math.max(...columnHeights)}px`;
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
  };

  const handleDeleteBatch = (batchId: string) => {
    if (confirm('确定要删除这个生成批次吗？')) {
      removeBatch(batchId);
    }
  };

  // 处理批次重新生成
  const handleBatchRegenerate = (batch: any) => {
    if (!onRegenerate) return;
    onRegenerate(batch);
  };

  // 处理批次反馈（乐观更新）
  const handleBatchFeedback = async (
    batchId: string,
    feedbackType: 'like' | 'dislike'
  ) => {
    // 获取当前批次
    const currentBatch = generationBatches.find(batch => batch.id === batchId);
    
    if (!currentBatch) {
      console.error('找不到对应的生成批次');
      return;
    }

    // 检查是否已经有相同的反馈（查看批次中第一张图片的反馈状态）
    const firstResult = currentBatch.results[0];
    const existingFeedback = firstResult?.userFeedback?.type;
    
    // 如果点击的是相同的反馈类型，则取消反馈
    const newFeedbackType = existingFeedback === feedbackType ? null : feedbackType;
    
    // 🎯 立即更新UI状态（乐观更新）
    currentBatch.results.forEach((_: any, index: number) => {
      updateImageFeedback(batchId, index, {
        type: newFeedbackType,
        submittedAt: newFeedbackType ? new Date() : undefined
      });
    });

    console.log(`✅ 批次反馈状态已更新: ${newFeedbackType}, 包含 ${currentBatch.results.length} 张图片`);
    
    // 🚀 在后台异步提交到数据库
    submitFeedbackToDatabase(currentBatch, newFeedbackType, batchId);
  };

  // 后台提交反馈到数据库
  const submitFeedbackToDatabase = async (
    batch: any,
    feedbackType: 'like' | 'dislike' | null,
    batchId: string
  ) => {
    try {
      const dbService = DatabaseService.getInstance();
      
      // 从配置中提取标签信息
      const tagsUsed: string[] = [];
      const selectedTags = batch.config.selectedTags;
      if (selectedTags) {
        if (selectedTags.artStyle) tagsUsed.push(selectedTags.artStyle);
        if (selectedTags.themeStyle) tagsUsed.push(selectedTags.themeStyle);
        if (selectedTags.mood) tagsUsed.push(selectedTags.mood);
        if (selectedTags.technical) tagsUsed.push(...selectedTags.technical);
        if (selectedTags.composition) tagsUsed.push(...selectedTags.composition);
        if (selectedTags.enhancement) tagsUsed.push(...selectedTags.enhancement);
      }
      
      // 为整个批次提交反馈
      const generationId = batch.realGenerationId || batch.id;
      const imageUrls = batch.results.map((result: any) => result.imageUrl);
      
      await dbService.submitImageFeedback({
        generationId,
        imageUrls,  // 传递整个批次的图片URL数组
        feedbackType: feedbackType,
        tagsUsed,
        modelUsed: batch.model
      });
      
      console.log(`✅ 批次反馈已提交到数据库: ${feedbackType}, 包含 ${imageUrls.length} 张图片`);
      
    } catch (error) {
      console.error('❌ 提交批次反馈到数据库失败:', error);
      
      // 🔄 如果提交失败，回滚UI状态
      console.warn('⚠️ 反馈提交失败，正在回滚UI状态...');
      
      // 获取失败前的状态（与当前状态相反）
      const rollbackFeedback = feedbackType === 'like' ? 'dislike' : 
                               feedbackType === 'dislike' ? 'like' : 
                               feedbackType; // 如果是null，保持null
      
             batch.results.forEach((_: any, index: number) => {
         updateImageFeedback(batchId, index, {
           type: rollbackFeedback,
           submittedAt: rollbackFeedback ? new Date() : undefined
         });
       });
      
      // 可选：显示错误提示
      // 这里可以添加toast通知用户提交失败
    }
  };

  // 渲染批次标题 - 直接使用数据库中的 tags_used 数据
  const renderBatchTitle = (batch: any) => {
    // 🔥 修复：直接使用数据库中保存的 tags_used 数据
    const tagsUsed = batch.results?.[0]?.tags_used || batch.tags_used || [];
    
    // 按分类分组标签
    const tagsByCategory = tagsUsed.reduce((acc: any, tag: any) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    }, {});
    
    // 获取基础提示词（去除技术标签后的描述）
    const getBasePrompt = (prompt: string) => {
      // 简单的清理，去除明显的技术术语
      return prompt
        .replace(/\b(photorealistic|highly detailed|8K|4K|professional|masterpiece|best quality)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    return (
      <div className="space-y-2">
        {/* 基础描述作为标题 */}
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {getBasePrompt(batch.prompt)}
        </h3>
        
        {/* 显示所有标签，按分类组织，不限制数量 */}
        <div className="flex flex-wrap gap-1">
          {/* 艺术风格标签 */}
          {tagsByCategory.art_style?.map((tag: any, index: number) => (
            <span 
              key={`art-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
            >
              🎨 {tag.name}
            </span>
          ))}
          
          {/* 主题风格标签 */}
          {tagsByCategory.theme_style?.map((tag: any, index: number) => (
            <span 
              key={`theme-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
            >
              🏷️ {tag.name}
            </span>
          ))}
          
          {/* 情绪氛围标签 */}
          {tagsByCategory.mood?.map((tag: any, index: number) => (
            <span 
              key={`mood-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"
            >
              😊 {tag.name}
            </span>
          ))}
          
          {/* 技术参数标签 */}
          {tagsByCategory.technical?.map((tag: any, index: number) => (
            <span 
              key={`tech-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
            >
              📷 {tag.name}
            </span>
          ))}
          
          {/* 构图参数标签 */}
          {tagsByCategory.composition?.map((tag: any, index: number) => (
            <span 
              key={`comp-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
            >
              🖼️ {tag.name}
            </span>
          ))}
          
          {/* 效果增强标签 */}
          {tagsByCategory.enhancement?.map((tag: any, index: number) => (
            <span 
              key={`enh-${index}`}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"
            >
              ✨ {tag.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  if (generationBatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无作品</h3>
        <p className="text-gray-600 max-w-md">
          开始你的AI创作之旅吧！在上方输入框中描述你想要的图像，点击生成按钮即可开始。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {generationBatches.map((batch) => {
        const isCollapsed = collapsedBatches.has(batch.id);
        
        return (
          <div key={batch.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 批次标题栏 */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Image className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    {/* 使用自定义的批次标题渲染 */}
                    {renderBatchTitle(batch)}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(batch.createdAt)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {batch.model}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400">
                          {batch.results.length} 张图片
                        </span>
                      </div>
                      {/* 反馈状态指示器 */}
                      {(() => {
                        const batchFeedback = batch.results[0]?.userFeedback?.type;
                        if (!batchFeedback) return null;
                        
                        return (
                          <div className="flex items-center space-x-1">
                            {batchFeedback === 'like' ? (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                <ThumbsUp className="w-3 h-3" />
                                <span>已点赞</span>
                              </div>
                            ) : batchFeedback === 'dislike' ? (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                <ThumbsDown className="w-3 h-3" />
                                <span>已踩</span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleBatchRegenerate(batch)}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="重新生成这批图片"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopyPrompt(batch.prompt)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="复制提示词"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBatch(batch.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除批次"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleBatchCollapse(batch.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={isCollapsed ? "展开" : "折叠"}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 批次内容 */}
            {!isCollapsed && (
              <div className="p-6 relative">
                <div
                  ref={gridRef}
                  className={`
                    relative w-full
                    ${viewMode === 'grid' 
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6' 
                      : ''
                    }
                  `}
                  style={viewMode === 'masonry' ? { height: getBatchMasonryHeight(batch.results) } : {}}
                >
                  {batch.results.map((item, index) => (
                    <div
                      key={`${batch.id}-${item.id || index}`}
                      className={`
                        group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300
                        ${viewMode === 'grid' ? 'aspect-square' : ''}
                      `}
                      style={getMasonryStyle(batch.results, index)}
                    >
                      {/* 图像 */}
                      <div className="relative overflow-hidden">
                        <LazyImage
                          src={item.imageUrl}
                          alt={batch.prompt}
                          className={`
                            w-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer
                            ${viewMode === 'grid' ? 'h-full' : 'h-auto'}
                          `}
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement;
                            handleImageLoad(item.imageUrl, img.naturalHeight * (img.offsetWidth / img.naturalWidth));
                          }}
                          onClick={() => handleImageClick(item.imageUrl, batch.id)}
                        />

                        {/* 悬浮操作按钮 */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(item.imageUrl);
                                setSelectedBatchId(batch.id);
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                              title="查看大图"
                            >
                              <Maximize2 className="w-5 h-5 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item.imageUrl, `ai-generated-${batch.createdAt.getTime()}-${index}.png`);
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                              title="下载图片"
                            >
                              <Download className="w-5 h-5 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // 分享功能
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                              title="分享图片"
                            >
                              <Share2 className="w-5 h-5 text-gray-700" />
                            </button>
                          </div>
                        </div>


                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 批次反馈按钮 - 右下角 */}
                <div className="absolute bottom-4 right-4 flex items-center space-x-2 z-10">
                  {(() => {
                    // 获取批次的整体反馈状态（基于第一张图片的反馈）
                    const batchFeedback = batch.results[0]?.userFeedback?.type;
                    
                    return (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBatchFeedback(batch.id, 'like');
                          }}
                          className={`group p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
                            batchFeedback === 'like'
                              ? 'bg-green-500 text-white shadow-green-200' 
                              : 'bg-white hover:bg-green-50 text-gray-700 border border-gray-200 hover:border-green-300'
                          }`}
                          title={batchFeedback === 'like' ? "取消点赞这批图片" : "点赞这批图片"}
                        >
                          <ThumbsUp className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBatchFeedback(batch.id, 'dislike');
                          }}
                          className={`group p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
                            batchFeedback === 'dislike'
                              ? 'bg-red-500 text-white shadow-red-200' 
                              : 'bg-white hover:bg-red-50 text-gray-700 border border-gray-200 hover:border-red-300'
                          }`}
                          title={batchFeedback === 'dislike' ? "取消踩这批图片" : "踩这批图片"}
                        >
                          <ThumbsDown className="w-5 h-5" />
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 增强的图像预览弹窗 - 带导航功能 */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-6xl max-h-full flex items-center justify-center">
            {/* 上一张按钮 */}
            {getCurrentImageIndex() > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 z-10"
                title="上一张 (←)"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* 下一张按钮 */}
            {getCurrentImageIndex() < getCurrentBatchImages().length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 z-10"
                title="下一张 (→)"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* 图片 */}
            <LazyImage
              src={selectedImage}
              alt="预览"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e?.stopPropagation()}
              priority={true}
            />

            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200"
              title="关闭 (Esc)"
            >
              <span className="sr-only">关闭</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 图片信息 */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
              {getCurrentImageIndex() + 1} / {getCurrentBatchImages().length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 