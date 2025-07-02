import { useState } from 'react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import type { GenerationResult } from '../types';

interface ImageGridProps {
  columns?: number;
  showHistory?: boolean;
  className?: string;
}

export function ImageGrid({ columns = 2, showHistory = true, className = '' }: ImageGridProps) {
  const { generationHistory, removeFromHistory, clearHistory } = useAIGenerationStore();
  const [selectedImage, setSelectedImage] = useState<GenerationResult | null>(null);
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, boolean>>({});

  // 图像加载完成处理
  const handleImageLoad = (id: string) => {
    setImageLoadStates(prev => ({ ...prev, [id]: true }));
  };

  // 图像加载错误处理
  const handleImageError = (id: string) => {
    console.error(`图像加载失败: ${id}`);
    setImageLoadStates(prev => ({ ...prev, [id]: false }));
  };

  // 下载图像
  const downloadImage = async (result: GenerationResult) => {
    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-generated-${result.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 复制图像URL
  const copyImageUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('图像链接已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  // 分享图像
  const shareImage = async (result: GenerationResult) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI生成的图像',
          text: `提示词: ${result.prompt}`,
          url: result.imageUrl,
        });
      } catch (error) {
        console.error('分享失败:', error);
      }
    } else {
      // 降级到复制链接
      copyImageUrl(result.imageUrl);
    }
  };

  // 获取显示的图像列表
  const displayImages = showHistory ? generationHistory : generationHistory.slice(0, 4);

  if (displayImages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-800 mb-2">还没有生成任何图像</h3>
        <p className="text-gray-600">在上方输入提示词，开始你的AI创作之旅</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部操作栏 */}
      {showHistory && generationHistory.length > 0 && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            生成历史 ({generationHistory.length})
          </h2>
          <button
            onClick={clearHistory}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            清空历史
          </button>
        </div>
      )}

      {/* 图像网格 */}
      <div 
        className={`grid gap-4 ${
          columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
          columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
          columns === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
        }`}
      >
        {displayImages.map((result) => (
          <div
            key={result.id}
            className="group relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* 图像容器 */}
            <div className="relative aspect-square overflow-hidden">
              {/* 加载占位符 */}
              {!imageLoadStates[result.id] && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              
              {/* 实际图像 */}
              <img
                src={result.imageUrl}
                alt={result.prompt}
                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                onLoad={() => handleImageLoad(result.id)}
                onError={() => handleImageError(result.id)}
                onClick={() => setSelectedImage(result)}
              />
              
              {/* 悬停遮罩 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(result);
                    }}
                    className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                    title="查看大图"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(result);
                    }}
                    className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                    title="下载图像"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      shareImage(result);
                    }}
                    className="p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                    title="分享图像"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* 图像信息 */}
            <div className="p-4">
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {result.prompt}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{result.createdAt.toLocaleDateString()}</span>
                <button
                  onClick={() => removeFromHistory(result.id)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  title="删除"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 图像预览模态框 */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* 图像 */}
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.prompt}
              className="w-full max-h-[80vh] object-contain"
            />
            
            {/* 信息栏 */}
            <div className="p-6 bg-gray-50">
              <p className="text-gray-800 mb-4">{selectedImage.prompt}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  生成时间: {selectedImage.createdAt.toLocaleString()}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadImage(selectedImage)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    下载图像
                  </button>
                  <button
                    onClick={() => shareImage(selectedImage)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    分享图像
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 