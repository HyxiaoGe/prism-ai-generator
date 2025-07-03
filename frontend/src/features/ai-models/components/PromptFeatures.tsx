import { parsePromptFeatures, getModelInfo, getColorClasses } from '../utils/promptParser';
import type { GenerationResult } from '../types';

interface PromptFeaturesProps {
  result: GenerationResult;
  compact?: boolean; // 紧凑模式，用于画廊视图
  showBasePrompt?: boolean; // 是否显示基础描述
}

export function PromptFeatures({ result, compact = false, showBasePrompt = true }: PromptFeaturesProps) {
  const features = parsePromptFeatures(result.prompt, result.config);
  const modelInfo = getModelInfo(result.config.model);

  if (compact) {
    // 紧凑模式：只显示最重要的几个标签
    return (
      <div className="flex flex-wrap gap-1 p-2">
        {/* 模型标签 */}
        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getColorClasses(modelInfo.color)}`}>
          <span className="mr-1">{modelInfo.icon}</span>
          {modelInfo.label}
        </span>

        {/* 艺术风格 */}
        {features.artStyle && (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getColorClasses(features.artStyle.color)}`}>
            <span className="mr-1">{features.artStyle.icon}</span>
            {features.artStyle.label}
          </span>
        )}

        {/* 主题风格 */}
        {features.themeStyle && (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getColorClasses(features.themeStyle.color)}`}>
            <span className="mr-1">{features.themeStyle.icon}</span>
            {features.themeStyle.label}
          </span>
        )}

        {/* 品质增强指示器 */}
        {features.qualityEnhanced && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800 border-orange-200">
            <span className="mr-1">✨</span>
            高品质
          </span>
        )}
      </div>
    );
  }

  // 完整模式：显示所有特征
  return (
    <div className="space-y-3">
      {/* 基础描述 */}
      {showBasePrompt && features.basePrompt && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">📝 核心描述</h4>
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {features.basePrompt}
          </p>
        </div>
      )}

      {/* 特征标签组 */}
      <div className="space-y-2">
        {/* 模型与参数 */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">🤖 模型配置</h4>
          <div className="flex flex-wrap gap-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(modelInfo.color)}`}>
              <span className="mr-1">{modelInfo.icon}</span>
              {modelInfo.label}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
              📐 {features.aspectRatio}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
              🔢 {features.inferenceSteps}步
            </span>
          </div>
        </div>

        {/* 风格特征 */}
        {(features.artStyle || features.themeStyle || features.mood) && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-1">🎨 风格特征</h4>
            <div className="flex flex-wrap gap-1">
              {features.artStyle && (
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(features.artStyle.color)}`}>
                  <span className="mr-1">{features.artStyle.icon}</span>
                  {features.artStyle.label}
                </span>
              )}
              {features.themeStyle && (
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(features.themeStyle.color)}`}>
                  <span className="mr-1">{features.themeStyle.icon}</span>
                  {features.themeStyle.label}
                </span>
              )}
              {features.mood && (
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(features.mood.color)}`}>
                  <span className="mr-1">{features.mood.icon}</span>
                  {features.mood.label}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 增强效果 */}
        {(features.enhancements.length > 0 || features.qualityEnhanced) && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-1">✨ 增强效果</h4>
            <div className="flex flex-wrap gap-1">
              {features.enhancements.map((enhancement, index) => (
                <span 
                  key={index}
                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(enhancement.color)}`}
                >
                  <span className="mr-1">{enhancement.icon}</span>
                  {enhancement.label}
                </span>
              ))}
              {features.qualityEnhanced && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800 border-orange-200">
                  <span className="mr-1">💎</span>
                  品质增强
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 简化版本，用于图像卡片底部
export function PromptFeaturesInline({ result }: { result: GenerationResult }) {
  const features = parsePromptFeatures(result.prompt, result.config);
  const modelInfo = getModelInfo(result.config.model);

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {/* 模型 */}
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(modelInfo.color)}`}>
        {modelInfo.icon} {modelInfo.label}
      </span>

      {/* 主要特征（最多显示2个） */}
      {features.artStyle && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(features.artStyle.color)}`}>
          {features.artStyle.icon} {features.artStyle.label}
        </span>
      )}
      
      {features.themeStyle && !features.artStyle && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(features.themeStyle.color)}`}>
          {features.themeStyle.icon} {features.themeStyle.label}
        </span>
      )}

      {/* 品质标识 */}
      {features.qualityEnhanced && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
          ✨
        </span>
      )}

      {/* 更多指示器 */}
      {(features.enhancements.length > 0 || features.mood) && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-600 border-gray-200">
          +{(features.enhancements.length + (features.mood ? 1 : 0))}
        </span>
      )}
    </div>
  );
} 