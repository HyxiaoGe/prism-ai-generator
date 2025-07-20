import React, { useEffect, useState } from 'react';
import { useAIGenerationStore } from '../../../store/aiGenerationStore';
import { AIService } from '../services/aiService';
import type { AIModel, GenerationConfig } from '../types';

interface ModelSelectorProps {
  disabled?: boolean;
  compact?: boolean;
}

export function ModelSelector({ disabled = false, compact = false }: ModelSelectorProps) {
  const { 
    selectedModel, 
    availableModels, 
    setSelectedModel, 
    setAvailableModels,
    currentConfig,
    updateConfig
  } = useAIGenerationStore();
  
  const [isLoading, setIsLoading] = useState(false);


  // 初始化加载可用模型
  useEffect(() => {
    const loadModels = async () => {
      setIsLoading(true);
      try {
        const models = await AIService.getAvailableModels();
        // 为模型添加默认的runsNumber字段
        const modelsWithRunsNumber = models.map(model => ({
          ...model,
          runsNumber: model.runsNumber || model.id
        }));
        setAvailableModels(modelsWithRunsNumber);
        
        // 如果没有选中模型，默认选择第一个可用模型
        if (!selectedModel && modelsWithRunsNumber.length > 0) {
          const defaultModel = modelsWithRunsNumber.find(m => m.id === 'flux-schnell') || modelsWithRunsNumber[0];
          setSelectedModel(defaultModel);
          updateConfig({ model: defaultModel.id });
        }
      } catch (error) {
        console.error('加载模型失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, [selectedModel, setSelectedModel, setAvailableModels, updateConfig]);

  // 处理模型选择
  const handleModelSelect = async (model: AIModel) => {
    setSelectedModel(model);
    
    // 获取模型的默认配置
    const defaultConfig = await AIService.getRecommendedConfig(model.id);
    
    // 使用模型的默认输出格式，如果不支持则使用第一个支持的格式
    const supportedFormats = model.capabilities.supportedFormats;
    const preferredFormat = defaultConfig.outputFormat;
    const newOutputFormat = supportedFormats.includes(preferredFormat as any) 
      ? preferredFormat 
      : (supportedFormats[0] || 'webp'); // 如果默认格式不支持，选择第一个支持的格式

    // 使用模型的默认生成数量，但不超过模型限制
    const maxOutputs = model.capabilities?.maxOutputs || 4;
    const adjustedNumOutputs = Math.min(defaultConfig.numOutputs || 1, maxOutputs);

    // 更新配置，使用模型的默认配置
    updateConfig({
      model: model.id,
      ...defaultConfig,
      // 使用模型默认配置，确保参数对应正确
      numInferenceSteps: defaultConfig.numInferenceSteps,
      aspectRatio: defaultConfig.aspectRatio,
      outputFormat: newOutputFormat,
      numOutputs: adjustedNumOutputs,
    });
  };

  // 处理参数配置更新
  const handleConfigUpdate = (key: keyof GenerationConfig, value: any) => {
    updateConfig({ [key]: value });
  };

  // 获取宽高比选项
  const aspectRatioOptions = [
    { value: '1:1', label: '正方形 (1:1)', desc: '适合头像、图标' },
    { value: '16:9', label: '横屏 (16:9)', desc: '适合风景、壁纸' },
    { value: '9:16', label: '竖屏 (9:16)', desc: '适合手机壁纸' },
    { value: '4:3', label: '经典 (4:3)', desc: '传统照片比例' },
    { value: '3:4', label: '竖版 (3:4)', desc: '适合人物肖像' },
  ];

  // 获取输出格式选项（根据选中模型动态调整）
  const getAllFormatOptions = () => {
    const allFormats = {
      'webp': { value: 'webp', label: 'WebP', desc: '最小文件，现代浏览器' },
      'jpg': { value: 'jpg', label: 'JPEG', desc: '通用格式，兼容性好' },
      'png': { value: 'png', label: 'PNG', desc: '支持透明，质量最高' },
    };
    
    if (!selectedModel) {
      return Object.values(allFormats);
    }
    
    // 根据选中模型的支持格式过滤
    return selectedModel.capabilities.supportedFormats.map(format => allFormats[format]).filter(Boolean);
  };

  const formatOptions = getAllFormatOptions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* 模型选择 */}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center justify-between">
          <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>🤖 AI模型选择</h4>
          {selectedModel && (
            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              {selectedModel.name}
            </div>
          )}
        </div>
        
        <div className="grid gap-3">
          {availableModels.map((model) => {
            const isSelected = selectedModel?.id === model.id;
            const costText = model.costPerGeneration ? 
              `$${(model.costPerGeneration * (currentConfig.numOutputs || 4)).toFixed(4)}` : 
              '免费';
            
            return (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model)}
                disabled={disabled || !model.isEnabled}
                className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h5 className="font-medium text-gray-900">{model.id}</h5>
                      <div className="flex space-x-1">
                        {model.tags.map((tag, index) => (
                          <span
                            key={index}
                            className={`text-xs px-2 py-1 rounded ${
                              tag === '推荐' ? 'bg-red-100 text-red-600' :
                              tag === '超快' ? 'bg-green-100 text-green-600' :
                              tag === '高质量' ? 'bg-purple-100 text-purple-600' :
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <span>🔥</span>
                        <span>{model.runsNumber} 次使用</span>
                      </span>
                      <span>•</span>
                      <span>by {model.name}</span>
                      <span>•</span>
                      <span>{costText}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>最大步数: {model.capabilities.maxSteps}</span>
                  <span>格式: {model.capabilities.supportedFormats.join(', ')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 基础参数配置 */}
      {selectedModel && (
        <div className={compact ? "space-y-3" : "space-y-4"}>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
            <h4 className={`font-medium text-blue-800 ${compact ? "text-sm" : ""}`}>⚙️ 生成参数</h4>
          </div>

          {/* 宽高比选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">📐 图像尺寸</label>
            <div className="grid grid-cols-1 gap-2">
              {aspectRatioOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleConfigUpdate('aspectRatio', option.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    currentConfig.aspectRatio === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.desc}</div>
                    </div>
                    {currentConfig.aspectRatio === option.value && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 输出数量 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">🔢 生成数量</label>
            <div className="grid grid-cols-4 gap-2">
              {(() => {
                // 根据模型能力动态生成可选数量
                const maxOutputs = selectedModel.capabilities?.maxOutputs || 4;
                const availableNumbers = [];
                for (let i = 1; i <= maxOutputs; i++) {
                  availableNumbers.push(i);
                }
                return availableNumbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => handleConfigUpdate('numOutputs', num)}
                    className={`p-2 text-sm rounded-lg border transition-colors ${
                      currentConfig.numOutputs === num
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {num}张
                  </button>
                ));
              })()}
            </div>
            {selectedModel.capabilities?.maxOutputs === 1 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ {selectedModel.name} 模型限制每次只能生成1张图片
              </p>
            )}
          </div>

          {/* 推理步数 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">🔄 推理步数</label>
              <span className="text-sm text-gray-500">{currentConfig.numInferenceSteps}</span>
            </div>
            <input
              type="range"
              min="1"
              max={selectedModel.capabilities.maxSteps}
              value={currentConfig.numInferenceSteps || selectedModel.defaultConfig.numInferenceSteps}
              onChange={(e) => handleConfigUpdate('numInferenceSteps', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>快速 (1)</span>
              <span>高质量 ({selectedModel.capabilities.maxSteps})</span>
            </div>
          </div>

          {/* 输出格式 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">🖼️ 输出格式</label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleConfigUpdate('outputFormat', option.value)}
                  className={`p-2 text-sm rounded-lg border transition-colors text-center ${
                    currentConfig.outputFormat === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 成本估算 */}
          {selectedModel?.costPerGeneration && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-800">💰 预估成本</span>
                <span className="text-sm text-yellow-700">
                  ${(selectedModel.costPerGeneration * (currentConfig.numOutputs || 4)).toFixed(4)}
                </span>
              </div>
              <div className="text-xs text-yellow-600 mt-1">
                {currentConfig.numOutputs}张图片 × ${selectedModel.costPerGeneration.toFixed(4)}/张
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 