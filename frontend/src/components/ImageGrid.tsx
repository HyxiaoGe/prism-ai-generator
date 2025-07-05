import { useState, useEffect, useRef } from 'react';
import { Download, Heart, Share2, Maximize2, Copy, Trash2, Sparkles, Clock, Image, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import { parsePromptFeatures } from '../features/ai-models/utils/promptParser';
import type { GenerationResult } from '../types';

interface ImageGridProps {
  viewMode: 'grid' | 'masonry';
  onRegenerate?: (batch: any) => void; // 新增：重新生成回调（批次级别）
}

export function ImageGrid({ viewMode, onRegenerate }: ImageGridProps) {
  const { generationBatches, removeBatch } = useAIGenerationStore();
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
    
    batchResults.forEach((item, index) => {
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

  // 渲染批次标题的简化版本
  const renderBatchTitle = (batch: any) => {
    const features = parsePromptFeatures(batch.prompt, batch.config);
    
    return (
      <div className="space-y-2">
        {/* 基础描述作为标题 */}
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {features.basePrompt || batch.prompt}
        </h3>
        
        {/* 关键标签 - 显示全部，不截断 */}
        <div className="flex flex-wrap gap-1">
          {/* 艺术风格 */}
          {features.artStyle && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              🎨 {features.artStyle.label}
            </span>
          )}
          
          {/* 主题风格 */}
          {features.themeStyle && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              🏷️ {features.themeStyle.label}
            </span>
          )}
          
          {/* 情绪氛围 */}
          {features.mood && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              😊 {features.mood.label}
            </span>
          )}
          
          {/* 显示所有增强效果，不限制数量 */}
          {features.enhancements.map((enhancement, index) => (
            <span 
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"
            >
              ✨ {enhancement.label}
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
              <div className="p-6">
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
                        <img
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
            <img
              src={selectedImage}
              alt="预览"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
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