import { useState, useEffect, useRef } from 'react';
import { Download, Heart, Share2, Maximize2, Copy, Trash2, Sparkles } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';

interface ImageGridProps {
  viewMode: 'grid' | 'masonry';
}

export function ImageGrid({ viewMode }: ImageGridProps) {
  const { generationHistory } = useAIGenerationStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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

  // 处理图像加载，记录高度
  const handleImageLoad = (imageUrl: string, height: number) => {
    setImageHeights(prev => ({
      ...prev,
      [imageUrl]: height
    }));
  };

  // 瀑布流布局计算
  const getMasonryStyle = (index: number) => {
    if (viewMode !== 'masonry') return {};

    const columnIndex = index % columnCount;
    const rowIndex = Math.floor(index / columnCount);

    // 计算每列的累计高度
    let columnHeight = 0;
    for (let i = 0; i < rowIndex; i++) {
      const itemIndex = i * columnCount + columnIndex;
      if (itemIndex < generationHistory.length) {
        const imageUrl = generationHistory[itemIndex].imageUrl;
        columnHeight += (imageHeights[imageUrl] || 320) + 24; // 24px 是间距
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

  // 计算瀑布流容器高度
  const getMasonryContainerHeight = () => {
    if (viewMode !== 'masonry' || generationHistory.length === 0) return 'auto';

    const columnHeights = Array(columnCount).fill(0);
    
    generationHistory.forEach((item, index) => {
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
    // 可以添加toast提示
  };

  if (generationHistory.length === 0) {
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
    <>
      {/* 图像网格 */}
      <div
        ref={gridRef}
        className={`
          relative w-full
          ${viewMode === 'grid' 
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6' 
            : ''
          }
        `}
        style={viewMode === 'masonry' ? { height: getMasonryContainerHeight() } : {}}
      >
        {generationHistory.map((item, index) => (
          <div
            key={`${item.createdAt.getTime()}-${index}`}
            className={`
              group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300
              ${viewMode === 'grid' ? 'aspect-square' : ''}
            `}
            style={getMasonryStyle(index)}
          >
            {/* 图像 */}
            <div className="relative overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.prompt}
                className={`
                  w-full object-cover transition-transform duration-300 group-hover:scale-105
                  ${viewMode === 'grid' ? 'h-full' : 'h-auto'}
                `}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  handleImageLoad(item.imageUrl, img.naturalHeight * (img.offsetWidth / img.naturalWidth));
                }}
                onClick={() => setSelectedImage(item.imageUrl)}
              />

              {/* 悬浮操作按钮 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(item.imageUrl);
                    }}
                    className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                  >
                    <Maximize2 className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(item.imageUrl, `ai-generated-${item.createdAt.getTime()}.png`);
                    }}
                    className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                  >
                    <Download className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 分享功能
                    }}
                    className="p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                  >
                    <Share2 className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* 模型标签 */}
              <div className="absolute top-3 left-3">
                <span className="px-2 py-1 bg-black/60 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                  {item.config.model}
                </span>
              </div>

              {/* 收藏按钮 */}
              <button className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100">
                <Heart className="w-4 h-4" />
              </button>
            </div>

            {/* 信息栏 */}
            <div className="p-4">
              <p className="text-sm text-gray-800 line-clamp-2 mb-3">
                {item.prompt}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {item.createdAt.toLocaleDateString()}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {item.config.model}
                  </span>
                </div>
                
                <button
                  onClick={() => handleCopyPrompt(item.prompt)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="复制提示词"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 图像预览模态框 */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="预览"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-3 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
            >
              <Trash2 className="w-5 h-5 rotate-45" />
            </button>

            {/* 操作按钮 */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
                             <button
                 onClick={() => {
                   const item = generationHistory.find(h => h.imageUrl === selectedImage);
                   if (item) handleDownload(item.imageUrl, `ai-generated-${item.createdAt.getTime()}.png`);
                 }}
                className="p-3 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
              >
                <Download className="w-5 h-5" />
              </button>
              <button className="p-3 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-all duration-200 hover:scale-110">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-3 bg-white/90 hover:bg-white text-red-600 rounded-full shadow-lg transition-all duration-200 hover:scale-110">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 