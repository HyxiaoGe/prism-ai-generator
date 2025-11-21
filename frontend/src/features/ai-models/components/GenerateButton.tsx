/**
 * 通用生成按钮组件
 * 统一管理AI图像生成的触发逻辑
 */

import React from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { useAIGenerationStore } from '@/store/aiGenerationStore';
import { useAuthStore } from '@/store/authStore';

interface GenerateButtonProps {
  /** 当前输入的提示词 */
  prompt?: string;
  /** 是否禁用按钮 */
  disabled?: boolean;
  /** 是否正在进行AI操作（分析、优化等） */
  isProcessing?: boolean;
  /** 处理中的提示文本 */
  processingText?: string;
  /** 当前所在的tab */
  currentTab?: 'model' | 'prompt' | 'advanced';
  /** 从首页选中的场景包ID */
  selectedScenePackId?: string | null;
  /** 点击下一步的回调 */
  onNext?: () => void;
}

/**
 * 通用生成按钮组件
 * 包含：配额显示、提示词预览、生成按钮
 */
export function GenerateButton({
  prompt = '',
  disabled = false,
  isProcessing = false,
  processingText = '处理中...',
  currentTab = 'model',
  selectedScenePackId = null,
  onNext
}: GenerateButtonProps) {
  const { startGeneration, currentConfig, currentGeneration } = useAIGenerationStore();
  const { appUser } = useAuthStore();

  // 计算剩余配额
  const remainingQuota = appUser ? (appUser.daily_quota - appUser.used_today) : 0;
  const hasQuota = remainingQuota > 0;

  // 构建完整提示词（基础提示词 + 标签）
  const fullPrompt = prompt.trim();

  // 判断是否显示"下一步"按钮（在模型配置tab且选中了场景包）
  const isShowingNext = currentTab === 'model' && selectedScenePackId;

  // 判断是否可以点击按钮
  const canClickButton = !disabled && !isProcessing && !currentGeneration.isGenerating;

  // 判断是否可以生成（需要在提示词tab且有提示词）
  const canGenerate = canClickButton && hasQuota && fullPrompt.length > 0;

  // 处理按钮点击
  const handleButtonClick = async () => {
    if (!canClickButton) return;

    // 如果在模型配置tab且选中了场景包，点击"下一步"
    if (isShowingNext) {
      onNext?.();
      return;
    }

    // 否则执行生成逻辑
    if (!canGenerate) return;

    try {
      // 使用当前配置进行生成，确保所有必填字段都有值
      await startGeneration({
        aspectRatio: currentConfig.aspectRatio || '1:1',
        numOutputs: currentConfig.numOutputs || 4,
        outputFormat: currentConfig.outputFormat || 'webp',
        numInferenceSteps: currentConfig.numInferenceSteps || 4,
        model: currentConfig.model || 'flux-schnell',
        prompt: fullPrompt,
        // 可选字段
        ...(currentConfig.seed !== undefined && { seed: currentConfig.seed }),
        ...(currentConfig.width && { width: currentConfig.width }),
        ...(currentConfig.height && { height: currentConfig.height }),
        ...(currentConfig.steps && { steps: currentConfig.steps }),
        ...(currentConfig.guidance && { guidance: currentConfig.guidance }),
        ...(currentConfig.parsedFeatures && { parsedFeatures: currentConfig.parsedFeatures }),
      });
    } catch (error) {
      console.error('生成失败:', error);
    }
  };

  // 获取按钮文本
  const getButtonText = () => {
    if (currentGeneration.isGenerating) return '正在生成...';
    if (isProcessing) return processingText;

    // 如果在模型配置tab且选中了场景包，显示"下一步"
    if (isShowingNext) return '下一步：配置提示词';

    // 否则显示生成相关的文本
    if (!hasQuota) return '配额已用完';
    if (!fullPrompt) return '请输入提示词';
    return '🚀 开始生成';
  };

  return (
    <div className="generate-button-container border-t border-gray-200 bg-white">
      <div className="p-6 space-y-4">

        {/* 配额和提示词信息栏 */}
        <div className="flex items-center justify-between text-sm">
          {/* 配额显示 */}
          {appUser && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasQuota ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-600">剩余配额</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`font-semibold ${hasQuota ? 'text-gray-900' : 'text-red-600'}`}>
                  {remainingQuota}
                </span>
                <span className="text-gray-500">/ {appUser.daily_quota}</span>
              </div>
            </div>
          )}

          {/* 提示词长度 */}
          <div className="flex items-center gap-2 text-gray-600">
            <span>提示词</span>
            <span className={`font-medium ${fullPrompt.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
              {fullPrompt.length} 字符
            </span>
          </div>
        </div>

        {/* 配额警告 */}
        {!hasQuota && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="font-medium">今日配额已用完</div>
              <div className="text-xs mt-1">明日凌晨自动重置，或联系客服升级套餐</div>
            </div>
          </div>
        )}

        {/* 提示词预览（可选展开） */}
        {fullPrompt.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">当前提示词预览</div>
            <div className="text-sm text-gray-700 line-clamp-2">
              {fullPrompt}
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleButtonClick}
          disabled={isShowingNext ? !canClickButton : !canGenerate}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg
            transition-all duration-200
            flex items-center justify-center gap-2
            ${(isShowingNext ? canClickButton : canGenerate)
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {currentGeneration.isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>正在生成中...</span>
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{processingText}</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              <span>{getButtonText()}</span>
            </>
          )}
        </button>

        {/* 快捷键提示 */}
        {canGenerate && (
          <div className="text-center text-xs text-gray-500">
            提示：使用 <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Enter</kbd> 快速生成
          </div>
        )}
      </div>
    </div>
  );
}
