import { useEffect, useState } from 'react';
import { useAIGenerationStore } from '../store/aiGenerationStore';

// 生成阶段配置
const GENERATION_STAGES = [
  { 
    stage: 'processing', 
    range: [0, 20], 
    label: '🧠 理解提示词...', 
    description: '正在分析您的创作需求',
    color: 'from-blue-400 to-blue-600' 
  },
  { 
    stage: 'processing', 
    range: [20, 60], 
    label: '🎨 生成草图...', 
    description: 'AI正在构思画面构图',
    color: 'from-purple-400 to-purple-600' 
  },
  { 
    stage: 'processing', 
    range: [60, 90], 
    label: '🖌️ 细化细节...', 
    description: '添加纹理和光影效果',
    color: 'from-pink-400 to-pink-600' 
  },
  { 
    stage: 'processing', 
    range: [90, 100], 
    label: '✨ 最终优化...', 
    description: '完善图像品质',
    color: 'from-green-400 to-green-600' 
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

  // 获取当前阶段信息
  const getCurrentStage = () => {
    const progress = currentGeneration.progress;
    return GENERATION_STAGES.find(stage => 
      progress >= stage.range[0] && progress < stage.range[1]
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
  const progress = Math.min(currentGeneration.progress, 100);
  const estimatedTotal = currentGeneration.estimatedTime ? Math.floor(currentGeneration.estimatedTime / 1000) : 30;
  const remainingTime = Math.max(0, estimatedTotal - elapsedTime);

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-md">
        {/* 头部信息 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {/* 旋转的AI图标 */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center animate-spin">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              {/* 脉冲效果 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-ping opacity-20"></div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">正在创作中</h3>
              <p className="text-sm text-gray-600">{currentStage.description}</p>
            </div>
          </div>
          
          {/* 时间信息 */}
          <div className="text-right text-sm text-gray-600">
            <div>{elapsedTime}s / {estimatedTotal}s</div>
            <div className="text-xs">剩余 ~{remainingTime}s</div>
          </div>
        </div>

        {/* 当前阶段 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {currentStage.label}
            </span>
            <span className="text-sm font-bold text-gray-800">
              {progress.toFixed(0)}%
            </span>
          </div>
          
          {/* 进度条 */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            {/* 背景渐变 */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-300"></div>
            
            {/* 进度条 */}
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${currentStage.color} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            >
              {/* 光泽效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
            
            {/* 动态光点 */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white/80 rounded-full transition-all duration-500"
              style={{ left: `${Math.max(0, progress - 1)}%` }}
            ></div>
          </div>
        </div>

        {/* 阶段指示器 */}
        <div className="flex justify-between mb-4">
          {GENERATION_STAGES.map((stage, index) => {
            const isActive = progress >= stage.range[0];
            const isCurrent = progress >= stage.range[0] && progress < stage.range[1];
            
            return (
              <div 
                key={index}
                className={`flex flex-col items-center transition-all duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                  isCurrent 
                    ? `bg-gradient-to-r ${stage.color} border-white shadow-lg scale-125` 
                    : isActive 
                      ? 'bg-green-500 border-green-500' 
                      : 'bg-gray-300 border-gray-300'
                }`}></div>
                <div className="text-xs mt-1 text-center">
                  {stage.range[1] === 100 ? '完成' : `${stage.range[1]}%`}
                </div>
              </div>
            );
          })}
        </div>

        {/* 创作技巧 */}
        {showTips && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-start space-x-2">
              <div className="text-blue-500 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-1">创作技巧</h4>
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