import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Heart, Share2, Maximize2, Copy, Trash2, Sparkles, Clock, Image, ChevronDown, ChevronUp, RotateCcw, ThumbsUp, ThumbsDown, X, Languages } from 'lucide-react';
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
  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    batchId: string;
    batchInfo: { prompt: string; imageCount: number } | null;
  }>({
    isOpen: false,
    batchId: '',
    batchInfo: null
  });
  
  // 翻译功能状态
  const [translations, setTranslations] = useState<Record<string, {
    isLoading: boolean;
    result: {
      chineseTranslation: string;
      explanation?: string;
      keyTerms?: Array<{english: string, chinese: string}>;
      confidence: number;
      fromCache: boolean;
    } | null;
    error: string | null;
  }>>({});
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
    navigator.clipboard.writeText(prompt).then(() => {
      // 显示复制成功的临时提示
      const notification = document.createElement('div');
      notification.textContent = '✅ 提示词已复制到剪贴板';
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300';
      document.body.appendChild(notification);
      
      // 3秒后自动移除提示
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
    }).catch(() => {
      // 复制失败提示
      const notification = document.createElement('div');
      notification.textContent = '❌ 复制失败，请重试';
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    });
  };

  const handleDeleteBatch = (batchId: string) => {
    // 获取批次信息用于确认提示
    const batch = generationBatches.find(b => b.id === batchId);
    if (!batch) return;
    
    const imageCount = batch.results.length || 0;
    const promptPreview = batch.prompt.substring(0, 50) + ((batch.prompt.length || 0) > 50 ? '...' : '');
    
    // 显示自定义删除确认对话框
    setDeleteConfirm({
      isOpen: true,
      batchId: batchId,
      batchInfo: {
        prompt: promptPreview,
        imageCount: imageCount
      }
    });
  };

  // 确认删除
  const confirmDelete = () => {
    const { batchId, batchInfo } = deleteConfirm;
    if (batchId && batchInfo) {
      removeBatch(batchId);
      
      // 关闭对话框
      setDeleteConfirm({ isOpen: false, batchId: '', batchInfo: null });
      
      // 显示删除成功提示
      const notification = document.createElement('div');
      notification.textContent = `🗑️ 已删除批次（${batchInfo.imageCount}张图片）`;
      notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
    }
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, batchId: '', batchInfo: null });
  };

  // 键盘支持和点击背景关闭
  useEffect(() => {
    if (!deleteConfirm.isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelDelete();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [deleteConfirm.isOpen]);

  // 翻译提示词功能
  const handleTranslatePrompt = async (batchId: string, prompt: string) => {
    // 检查是否已有翻译结果
    if (translations[batchId]?.result) {
      return;
    }

    // 设置加载状态
    setTranslations(prev => ({
      ...prev,
      [batchId]: {
        isLoading: true,
        result: null,
        error: null
      }
    }));

    try {
      const databaseService = DatabaseService.getInstance();
      const result = await databaseService.translatePrompt(prompt);
      
      // 设置翻译结果
      setTranslations(prev => ({
        ...prev,
        [batchId]: {
          isLoading: false,
          result: result,
          error: null
        }
      }));

      // 显示翻译完成提示
      const notification = document.createElement('div');
      notification.textContent = result.fromCache 
        ? '🎯 从缓存获取翻译结果' 
        : '🌐 翻译完成';
      notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);

    } catch (error) {
      console.error('翻译失败:', error);
      
      // 设置错误状态
      setTranslations(prev => ({
        ...prev,
        [batchId]: {
          isLoading: false,
          result: null,
          error: error instanceof Error ? error.message : '翻译失败'
        }
      }));

      // 显示错误提示
      const notification = document.createElement('div');
      notification.textContent = '❌ 翻译失败，请重试';
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
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
                    title="🔄 重新生成这批图片（使用相同设置）"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCopyPrompt(batch.prompt)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="📋 复制提示词到剪贴板"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTranslatePrompt(batch.id, batch.prompt)}
                    disabled={translations[batch.id]?.isLoading}
                    className={`p-2 rounded-lg transition-colors ${
                      translations[batch.id]?.isLoading
                        ? 'text-gray-300 cursor-not-allowed'
                        : translations[batch.id]?.result
                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title={
                      translations[batch.id]?.isLoading
                        ? '🌐 翻译中...'
                        : translations[batch.id]?.result
                        ? '✅ 已翻译，点击查看详情'
                        : '🌐 翻译提示词为中文'
                    }
                  >
                    <Languages className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBatch(batch.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="🗑️ 删除这个批次（不可恢复）"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleBatchCollapse(batch.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={isCollapsed ? "📖 展开查看所有图片" : "📚 折叠隐藏图片"}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 批次内容 */}
            {!isCollapsed && (
              <div className="p-6 relative">
                {/* 翻译结果显示 */}
                {translations[batch.id]?.result && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Languages className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-blue-900">中文翻译</h4>
                          {translations[batch.id]?.result?.fromCache && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              缓存
                            </span>
                          )}
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            {translations[batch.id]?.result?.confidence}% 置信度
                          </span>
                        </div>
                        <p className="text-blue-800 mb-3 leading-relaxed">
                          {translations[batch.id]?.result?.chineseTranslation}
                        </p>
                        
                        {translations[batch.id]?.result?.explanation && (
                          <div className="mb-3">
                            <p className="text-sm text-blue-700">
                              <span className="font-medium">说明：</span>
                              {translations[batch.id]?.result?.explanation}
                            </p>
                          </div>
                        )}
                        
                        {(() => {
                          const keyTerms = translations[batch.id]?.result?.keyTerms;
                          if (!keyTerms || keyTerms.length === 0) return null;
                          
                          return (
                            <div>
                              <p className="text-sm font-medium text-blue-900 mb-2">关键术语对照：</p>
                              <div className="flex flex-wrap gap-2">
                                {keyTerms.map((term: any, index: number) => (
                                  <div key={index} className="px-3 py-1 bg-white border border-blue-200 rounded-full text-xs">
                                    <span className="text-blue-600 font-medium">{term.english}</span>
                                    <span className="text-gray-500 mx-1">→</span>
                                    <span className="text-blue-800">{term.chinese}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                
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
                              title="🔍 点击查看高清大图"
                            >
                              <Maximize2 className="w-5 h-5 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item.imageUrl, `ai-generated-${batch.createdAt.getTime()}-${index}.png`);
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                              title="💾 下载图片到本地"
                            >
                              <Download className="w-5 h-5 text-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // 复制图片链接到剪贴板
                                navigator.clipboard.writeText(item.imageUrl).then(() => {
                                  const notification = document.createElement('div');
                                  notification.textContent = '🔗 图片链接已复制，可以分享给朋友了';
                                  notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                                  document.body.appendChild(notification);
                                  
                                  setTimeout(() => {
                                    notification.style.opacity = '0';
                                    setTimeout(() => {
                                      document.body.removeChild(notification);
                                    }, 300);
                                  }, 2000);
                                }).catch(() => {
                                  const notification = document.createElement('div');
                                  notification.textContent = '❌ 复制链接失败，请重试';
                                  notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                                  document.body.appendChild(notification);
                                  
                                  setTimeout(() => {
                                    document.body.removeChild(notification);
                                  }, 2000);
                                });
                              }}
                              className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                              title="🔗 复制图片链接，方便分享"
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
                          title={batchFeedback === 'like' ? "👍 已点赞，点击取消" : "👍 觉得这批图片不错？点个赞吧"}
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
                          title={batchFeedback === 'dislike' ? "👎 已标记不满意，点击取消" : "👎 图片效果不理想？标记一下帮助改进"}
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

      {/* 自定义删除确认对话框 */}
      {deleteConfirm.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelDelete();
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* 头部 */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                </div>
                <button
                  onClick={cancelDelete}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 内容 */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                你确定要删除这个生成批次吗？删除后将无法恢复。
              </p>
              
              {deleteConfirm.batchInfo && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-medium">📝</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 mb-1">提示词</p>
                      <p className="text-sm text-gray-900 break-words">
                        {deleteConfirm.batchInfo.prompt}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 text-xs font-medium">🖼️</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">包含图片</p>
                      <p className="text-sm font-medium text-gray-900">
                        {deleteConfirm.batchInfo.imageCount} 张
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="p-6 border-t border-gray-100 flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 