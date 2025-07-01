import { useState } from 'react';
import { Download, ZoomIn, Copy, Trash2, Clock } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import type { GenerationResult } from '../types';

interface ImageGridProps {
  className?: string;
}

interface ImageModalProps {
  image: GenerationResult;
  isOpen: boolean;
  onClose: () => void;
}

function ImageModal({ image, isOpen, onClose }: ImageModalProps) {
  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prism-ai-${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    // TODO: 添加toast提示
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">生成的图像</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <img
              src={image.imageUrl}
              alt={image.prompt}
              className="w-full h-auto rounded-lg"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">提示词</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {image.prompt}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">尺寸：</span>
                <span className="font-medium">{image.config.width} × {image.config.height}</span>
              </div>
              <div>
                <span className="text-gray-500">步数：</span>
                <span className="font-medium">{image.config.steps}</span>
              </div>
              <div>
                <span className="text-gray-500">引导度：</span>
                <span className="font-medium">{image.config.guidance}</span>
              </div>
              <div>
                <span className="text-gray-500">生成时间：</span>
                <span className="font-medium">{image.createdAt.toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="btn-primary flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                下载图像
              </button>
              <button
                onClick={handleCopyPrompt}
                className="btn-secondary flex items-center"
              >
                <Copy className="w-4 h-4 mr-2" />
                复制提示词
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageGrid({ className = '' }: ImageGridProps) {
  const { generationHistory, removeFromHistory, clearHistory } = useAIGenerationStore();
  const [selectedImage, setSelectedImage] = useState<GenerationResult | null>(null);

  if (generationHistory.length === 0) {
    return (
      <div className={`card p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-4">
          <ZoomIn className="w-12 h-12 mx-auto mb-4" />
          <p className="text-lg font-medium">还没有生成的图像</p>
          <p className="text-sm">输入提示词开始创作您的第一张AI图像</p>
        </div>
      </div>
    );
  }

  // 获取最新的4张图像用于主要展示
  const latestImages = generationHistory.slice(0, 4);
  const hasMoreImages = generationHistory.length > 4;

  const handleImageDownload = async (image: GenerationResult) => {
    try {
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prism-ai-${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 主要图像网格 */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            生成结果
          </h2>
          {generationHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-sm text-gray-500 hover:text-red-600 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              清除历史
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {latestImages.map((image) => (
            <div
              key={image.id}
              className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-square"
            >
              <img
                src={image.imageUrl}
                alt={image.prompt}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              
              {/* 悬浮操作按钮 */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50"
                    title="查看大图"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleImageDownload(image)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50"
                    title="下载图像"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromHistory(image.id)}
                    className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 图像信息 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                <p className="text-white text-xs line-clamp-2 mb-1">
                  {image.prompt}
                </p>
                <div className="flex items-center text-white text-xs opacity-75">
                  <Clock className="w-3 h-3 mr-1" />
                  {image.createdAt.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 历史记录 */}
      {hasMoreImages && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            历史记录 ({generationHistory.length - 4} 张更多图像)
          </h3>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {generationHistory.slice(4).map((image) => (
              <div
                key={image.id}
                className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all duration-200"
                onClick={() => setSelectedImage(image)}
              >
                <img
                  src={image.imageUrl}
                  alt={image.prompt}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 图像详情模态框 */}
      <ImageModal
        image={selectedImage!}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
} 