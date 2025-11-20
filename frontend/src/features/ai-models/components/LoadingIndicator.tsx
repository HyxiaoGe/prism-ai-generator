import { useEffect, useState } from 'react';
import { useAIGenerationStore } from '../../../store/aiGenerationStore';

// 生成阶段配置（基于时间而不是假进度）
const GENERATION_STAGES = [
  {
    timeRange: [0, 5],
    label: '⏳ 等待服务器响应',
    description: '正在连接AI服务器...',
    color: 'from-gray-400 to-gray-600',
  },
  {
    timeRange: [5, 15],
    label: '🧠 理解提示词',
    description: '正在分析您的创作需求',
    color: 'from-blue-400 to-blue-600',
  },
  {
    timeRange: [15, 35],
    label: '🎨 生成图像',
    description: 'AI正在创作您的作品',
    color: 'from-purple-400 to-purple-600',
  },
  {
    timeRange: [35, 60],
    label: '✨ 优化细节',
    description: '完善图像品质和细节',
    color: 'from-pink-400 to-pink-600',
  },
];

// 创作技巧轮播
const CREATION_TIPS = [
  '💡 使用具体的形容词能让AI更好地理解你的想法',
  '🎨 添加艺术风格关键词如"油画风格"、"水彩画"等',
  '📸 尝试描述光线和构图，如"柔和的晨光"、"俯视角度"',
  '🌈 色彩描述很重要，如"温暖的橙红色调"',
  '✨ 使用"高质量"、"4K分辨率"等词提升图像品质',
  '🎭 情绪词汇能营造氛围，如"神秘"、"欢快"、"宁静"',
];

interface LoadingIndicatorProps {
  showTips?: boolean;
  className?: string;
}

export function LoadingIndicator({ showTips = true, className = '' }: LoadingIndicatorProps) {
  const { currentGeneration } = useAIGenerationStore();
  const [currentTip, setCurrentTip] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 根据实际等待时间获取当前阶段
  const getCurrentStage = () => {
    return GENERATION_STAGES.find(stage =>
      elapsedTime >= stage.timeRange[0] && elapsedTime < stage.timeRange[1]
    ) || GENERATION_STAGES[GENERATION_STAGES.length - 1];
  };

  // 技巧轮播
  useEffect(() => {
    if (!currentGeneration.isGenerating || !showTips) return;

    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % CREATION_TIPS.length);
    }, 3000);

    return () => clearInterval(tipInterval);
  }, [currentGeneration.isGenerating, showTips]);

  // 计时器
  useEffect(() => {
    if (!currentGeneration.isGenerating) {
      setElapsedTime(0);
      return;
    }

    const startTime = currentGeneration.startTime || new Date();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentGeneration.isGenerating, currentGeneration.startTime]);

  // 如果不在生成状态，不显示
  if (!currentGeneration.isGenerating) {
    return null;
  }

  const currentStage = getCurrentStage();
  const estimatedTotal = currentGeneration.estimatedTime ? Math.floor(currentGeneration.estimatedTime / 1000) : 45;

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
        {/* 头部 - AI图标 */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            {/* 旋转的AI图标 */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center animate-spin">
              <span className="text-white font-bold text-xl">AI</span>
            </div>
            {/* 脉冲效果 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-ping opacity-20"></div>
          </div>

          {/* 当前阶段标题 */}
          <h3 className="text-xl font-bold text-gray-800 mb-1">
            {currentStage.label}
          </h3>
          <p className="text-sm text-gray-600">{currentStage.description}</p>
        </div>

        {/* 阶段进度指示器 */}
        <div className="flex justify-between items-center mb-6 px-4 relative">
          {GENERATION_STAGES.map((stage, index) => {
            const isPassed = elapsedTime >= stage.timeRange[0];
            const isCurrent = elapsedTime >= stage.timeRange[0] && elapsedTime < stage.timeRange[1];

            return (
              <div key={index} className="flex flex-col items-center flex-1 relative">
                {/* 圆点 */}
                <div className={`relative z-10 w-4 h-4 rounded-full border-2 transition-all duration-500 ${
                  isCurrent
                    ? `bg-gradient-to-r ${stage.color} border-white shadow-lg scale-150 animate-pulse`
                    : isPassed
                      ? 'bg-green-500 border-green-500 scale-110'
                      : 'bg-white border-gray-300'
                }`}>
                  {isPassed && !isCurrent && (
                    <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* 阶段标签 */}
                <div className={`text-xs mt-2 text-center transition-opacity ${
                  isCurrent ? 'opacity-100 font-medium' : 'opacity-40'
                }`}>
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* 加载动画条（脉冲式，不显示百分比） */}
        <div className="mb-6">
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentStage.color} rounded-full animate-pulse`}
                 style={{ width: '100%' }}>
              {/* 流动效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* 时间信息 */}
        <div className="flex justify-between items-center mb-6 text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>已等待 {elapsedTime}秒</span>
          </div>
          <div className="text-gray-500">
            预计 ~{estimatedTotal}秒
          </div>
        </div>

        {/* 创作技巧 */}
        {showTips && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start space-x-2">
              <div className="text-blue-500 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-1">💡 创作技巧</h4>
                <p className="text-sm text-blue-700 transition-all duration-500">
                  {CREATION_TIPS[currentTip]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 错误显示 */}
        {currentGeneration.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800">生成失败</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{currentGeneration.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
