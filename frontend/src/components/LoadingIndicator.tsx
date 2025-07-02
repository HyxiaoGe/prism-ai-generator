import { Brain, Palette, Sparkles, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';

interface LoadingIndicatorProps {
  className?: string;
}

export function LoadingIndicator({ className = '' }: LoadingIndicatorProps) {
  const { currentGeneration } = useAIGenerationStore();

  if (!currentGeneration.isGenerating && currentGeneration.stage === 'idle') {
    return null;
  }

  // 文档建议的4阶段进度显示
  const getStageInfo = () => {
    const progress = currentGeneration.progress;
    
    if (progress < 20) {
      return {
        icon: Brain,
        title: '🧠 理解提示词',
        description: '正在分析您的创意描述，理解要生成的内容...',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    } else if (progress < 60) {
      return {
        icon: Palette,
        title: '🎨 生成草图',
        description: 'AI正在创建图像的基本结构和构图...',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      };
    } else if (progress < 90) {
      return {
        icon: Sparkles,
        title: '🖌️ 细化细节',
        description: '正在添加精细的纹理、光影和细节...',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200'
      };
    } else if (progress < 100) {
      return {
        icon: Zap,
        title: '✨ 最终优化',
        description: '正在进行最后的色彩调整和细节优化...',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      };
    }

    switch (currentGeneration.stage) {
      case 'completed':
        return {
          icon: CheckCircle,
          title: '🎉 生成完成',
          description: '您的AI艺术作品已经准备好了！',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'error':
        return {
          icon: AlertCircle,
          title: '❌ 生成失败',
          description: currentGeneration.error || '发生了未知错误，请重试',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: Brain,
          title: '⚡ 准备中',
          description: '正在初始化AI生成引擎...',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
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

  // 动态进度条颜色
  const getProgressBarColor = () => {
    const progress = currentGeneration.progress;
    if (progress < 20) return 'bg-blue-500';
    if (progress < 60) return 'bg-purple-500';
    if (progress < 90) return 'bg-indigo-500';
    return 'bg-orange-500';
  };

  return (
    <div className={`bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/60 shadow-xl ${className}`}>
      <div className="flex items-center space-x-4">
        {/* 动画图标 */}
        <div className={`${stageInfo.color} ${currentGeneration.isGenerating ? 'animate-pulse' : ''}`}>
          <Icon className="w-10 h-10" />
        </div>

        {/* 状态信息 */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1 text-lg">
            {stageInfo.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {stageInfo.description}
          </p>

          {/* 进度条 */}
          {currentGeneration.isGenerating && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>生成进度</span>
                <span className="font-semibold">{currentGeneration.progress}%</span>
              </div>
              <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`${getProgressBarColor()} h-3 rounded-full transition-all duration-500 ease-out relative`}
                  style={{ width: `${currentGeneration.progress}%` }}
                >
                  {/* 进度条光泽效果 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              {/* 时间估算 */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>预计完成时间</span>
                <span>{timeRemaining ? `${timeRemaining} 秒` : '计算中...'}</span>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {currentGeneration.stage === 'error' && currentGeneration.error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>错误详情：</strong>{currentGeneration.error}
              </p>
              <p className="text-xs text-red-600 mt-1">
                💡 建议：检查网络连接或尝试简化提示词
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 文档建议的4阶段可视化指示器 */}
      {currentGeneration.isGenerating && (
        <div className="mt-6 p-4 bg-white/50 rounded-lg">
          <div className="flex justify-between items-center">
            {[
              { stage: 'understanding', label: '理解提示词', range: [0, 20] },
              { stage: 'generating', label: '生成草图', range: [20, 60] },
              { stage: 'refining', label: '细化细节', range: [60, 90] },
              { stage: 'optimizing', label: '最终优化', range: [90, 100] }
            ].map((item, index) => {
              const progress = currentGeneration.progress;
              const isActive = progress >= item.range[0] && progress < item.range[1];
              const isCompleted = progress >= item.range[1];

              return (
                <div key={item.stage} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                    ${isCompleted 
                      ? 'bg-green-500 text-white shadow-lg' 
                      : isActive 
                        ? 'bg-blue-500 text-white ring-4 ring-blue-200 shadow-lg animate-pulse' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div className="ml-2 text-center">
                    <div className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.range[0]}-{item.range[1]}%
                    </div>
                  </div>
                  {index < 3 && (
                    <div className={`mx-4 h-1 w-16 rounded transition-all duration-300 ${
                      isCompleted ? 'bg-green-400' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 