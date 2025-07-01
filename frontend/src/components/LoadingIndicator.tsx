
import { Brain, Palette, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';

interface LoadingIndicatorProps {
  className?: string;
}

export function LoadingIndicator({ className = '' }: LoadingIndicatorProps) {
  const { currentGeneration } = useAIGenerationStore();

  if (!currentGeneration.isGenerating && currentGeneration.stage === 'idle') {
    return null;
  }

  const getStageInfo = () => {
    switch (currentGeneration.stage) {
      case 'processing':
        return {
          icon: Brain,
          title: '分析提示词',
          description: '正在理解您的创意描述...',
          color: 'text-blue-600'
        };
      case 'generating':
        return {
          icon: Palette,
          title: '生成图像',
          description: 'AI正在创作您的图像...',
          color: 'text-purple-600'
        };
      case 'completing':
        return {
          icon: Sparkles,
          title: '完善细节',
          description: '正在添加最后的润色...',
          color: 'text-indigo-600'
        };
      case 'completed':
        return {
          icon: CheckCircle,
          title: '生成完成',
          description: '您的图像已经准备好了！',
          color: 'text-green-600'
        };
      case 'error':
        return {
          icon: AlertCircle,
          title: '生成失败',
          description: currentGeneration.error || '发生了未知错误',
          color: 'text-red-600'
        };
      default:
        return {
          icon: Brain,
          title: '准备中',
          description: '正在准备生成...',
          color: 'text-gray-600'
        };
    }
  };

  const stageInfo = getStageInfo();
  const Icon = stageInfo.icon;

  const getEstimatedTimeRemaining = () => {
    if (!currentGeneration.estimatedTime || !currentGeneration.startTime) {
      return null;
    }

    const elapsed = Date.now() - currentGeneration.startTime.getTime();
    const total = currentGeneration.estimatedTime;
    const remaining = Math.max(0, total - elapsed);
    
    return Math.ceil(remaining / 1000);
  };

  const timeRemaining = getEstimatedTimeRemaining();

  return (
    <div className={`card p-6 ${className}`}>
      <div className="flex items-center space-x-4">
        {/* 动画图标 */}
        <div className={`${stageInfo.color} ${currentGeneration.isGenerating ? 'animate-pulse' : ''}`}>
          <Icon className="w-8 h-8" />
        </div>

        {/* 状态信息 */}
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 mb-1">
            {stageInfo.title}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {stageInfo.description}
          </p>

          {/* 进度条 */}
          {currentGeneration.isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>进度</span>
                <span>{currentGeneration.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${currentGeneration.progress}%` }}
                />
              </div>
              {timeRemaining && (
                <p className="text-xs text-gray-500 text-center">
                  预计剩余时间: {timeRemaining} 秒
                </p>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {currentGeneration.stage === 'error' && currentGeneration.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                {currentGeneration.error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 生成阶段指示器 */}
      {currentGeneration.isGenerating && (
        <div className="mt-6 flex justify-between items-center">
          {[
            { stage: 'processing', label: '分析' },
            { stage: 'generating', label: '生成' },
            { stage: 'completing', label: '完成' }
          ].map((item, index) => {
            const isCurrent = currentGeneration.stage === item.stage;
            const isCompleted = 
              (currentGeneration.stage === 'generating' && item.stage === 'processing') ||
              (currentGeneration.stage === 'completing' && ['processing', 'generating'].includes(item.stage)) ||
              (currentGeneration.stage === 'completed' && ['processing', 'generating', 'completing'].includes(item.stage));

            return (
              <div key={item.stage} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${isCompleted 
                    ? 'bg-primary-600 text-white' 
                    : isCurrent 
                      ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-600' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${isCurrent ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
                {index < 2 && (
                  <div className={`mx-4 h-0.5 w-12 ${isCompleted ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 