import React, { useState, useEffect } from 'react';
import { Wand2, Sparkles, Settings, Zap, DollarSign, Tag, Lightbulb } from 'lucide-react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import { AIService } from '../services/aiService';
import type { GenerationConfig, AIModel } from '../types';

interface PromptInputProps {
  className?: string;
  initialPrompt?: string;
}

// 智能提示词建议数据
const STYLE_TAGS = [
  { label: '摄影级逼真', value: 'photorealistic, highly detailed, professional photography' },
  { label: '油画风格', value: 'oil painting style, artistic, classical art' },
  { label: '赛博朋克', value: 'cyberpunk style, neon lights, futuristic, sci-fi' },
  { label: '水彩画', value: 'watercolor painting, soft colors, artistic' },
  { label: '动漫风格', value: 'anime style, manga, japanese art' },
  { label: '像素艺术', value: 'pixel art, 8-bit style, retro gaming' },
  { label: '素描风格', value: 'pencil sketch, line art, black and white' },
  { label: '梦幻风格', value: 'dreamy, ethereal, fantasy art, magical' },
];

const MOOD_TAGS = [
  { label: '温暖明亮', value: 'warm lighting, bright, cheerful, sunny' },
  { label: '神秘暗黑', value: 'dark, mysterious, moody lighting, shadows' },
  { label: '浪漫唯美', value: 'romantic, beautiful, soft lighting, elegant' },
  { label: '史诗壮观', value: 'epic, cinematic, dramatic, grand scale' },
];

const QUALITY_ENHANCERS = [
  'highly detailed',
  'masterpiece',
  'best quality',
  'ultra high resolution',
  '4K',
  'professional',
  'award winning',
];

const COMMON_SUBJECTS = [
  '一只可爱的小猫',
  '未来科技城市',
  '古老的森林',
  '宇宙中的星球',
  '魔法师在施法',
  '日本樱花树',
  '机器人朋友',
  '龙在飞翔',
];

export function PromptInput({ className = '', initialPrompt = '' }: PromptInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  
  const {
    currentGeneration,
    currentConfig,
    updateConfig,
    startGeneration,
    cancelGeneration,
  } = useAIGenerationStore();

  // 监听外部传入的初始提示词
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // 加载可用模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await AIService.getAvailableModels();
        setAvailableModels(models);
        if (models.length > 0) {
          const defaultModel = models.find(m => m.tags.includes('推荐')) || models[0];
          setSelectedModel(defaultModel);
          updateConfig({
            model: defaultModel.id,
            ...defaultModel.defaultConfig,
          });
        }
      } catch (error) {
        console.error('加载模型失败:', error);
      }
    };
    loadModels();
  }, [updateConfig]);

  const handleModelChange = (modelId: string) => {
    const model = availableModels.find(m => m.id === modelId);
    if (model) {
      setSelectedModel(model);
      updateConfig({
        model: model.id,
        ...model.defaultConfig,
      });
    }
  };

  // 智能提示词增强
  const enhancePrompt = (basePrompt: string, styleTag?: string, moodTag?: string) => {
    let enhanced = basePrompt.trim();
    
    if (styleTag) {
      enhanced += `, ${styleTag}`;
    }
    
    if (moodTag) {
      enhanced += `, ${moodTag}`;
    }
    
    // 添加质量增强词
    const randomQuality = QUALITY_ENHANCERS[Math.floor(Math.random() * QUALITY_ENHANCERS.length)];
    enhanced += `, ${randomQuality}`;
    
    return enhanced;
  };

  const addStyleTag = (styleValue: string) => {
    const enhanced = enhancePrompt(prompt, styleValue);
    setPrompt(enhanced);
  };

  const addMoodTag = (moodValue: string) => {
    const enhanced = enhancePrompt(prompt, undefined, moodValue);
    setPrompt(enhanced);
  };

  const useSubjectSuggestion = (subject: string) => {
    setPrompt(subject);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || currentGeneration.isGenerating) return;

    const config: GenerationConfig = {
      prompt: prompt.trim(),
      aspectRatio: currentConfig.aspectRatio || '1:1',
      numOutputs: currentConfig.numOutputs || 4,
      outputFormat: currentConfig.outputFormat || 'webp',
      numInferenceSteps: currentConfig.numInferenceSteps || 4,
      model: currentConfig.model || 'flux-schnell',
    };

    await startGeneration(config);
  };

  const handleCancel = () => {
    cancelGeneration();
  };

  const examplePrompts = [
    "一只橘色小猫坐在木质窗台上，阳光透过蕾丝窗帘洒在它的毛发上，温馨的下午氛围",
    "未来派机器人正在一个充满霓虹灯的工作室里创作数字艺术，赛博朋克风格，细节丰富",
    "山谷中的樱花树林，粉色花瓣飘落在清澈的小溪里，春天的诗意景象，油画风格",
    "外星球上的城市，双月悬挂在紫色天空中，建筑物发出蓝绿色光芒，科幻概念艺术"
  ];

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/60 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 模型选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Zap className="inline w-4 h-4 mr-1" />
            选择AI模型
          </label>
          <div className="grid grid-cols-1 gap-3">
            {availableModels.map((model) => (
              <div
                key={model.id}
                className={`relative p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedModel?.id === model.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handleModelChange(model.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{model.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {model.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            tag === '推荐'
                              ? 'bg-green-100 text-green-800'
                              : tag === '快速' || tag === '超快'
                              ? 'bg-blue-100 text-blue-800'
                              : tag === '高质量' || tag === '专业'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center ml-2">
                    <DollarSign className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      ${model.costPerGeneration?.toFixed(3)}
                    </span>
                  </div>
                </div>
                {selectedModel?.id === model.id && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 智能提示词输入区域 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="prompt" className="text-sm font-medium text-gray-700">
              <Sparkles className="inline w-4 h-4 mr-1" />
              描述你想要生成的图像
            </label>
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              AI建议
            </button>
          </div>
          
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一只穿着太空服的猫咪在月球上种花，科幻风格，星空背景..."
            className="input-field resize-none"
            rows={4}
            disabled={currentGeneration.isGenerating}
          />

          {/* 智能建议面板 */}
          {showSuggestions && (
            <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Tag className="w-4 h-4 mr-1" />
                💡 智能提示词增强
              </h4>
              
              {/* 主题建议 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">🎯 主题建议</h5>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SUBJECTS.slice(0, 4).map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => useSubjectSuggestion(subject)}
                      className="px-3 py-1 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-full transition-colors"
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>

              {/* 风格标签 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">🎨 风格标签</h5>
                <div className="flex flex-wrap gap-2">
                  {STYLE_TAGS.slice(0, 6).map((style) => (
                    <button
                      key={style.label}
                      type="button"
                      onClick={() => addStyleTag(style.value)}
                      className="px-3 py-1 text-sm bg-white hover:bg-purple-50 border border-purple-200 rounded-full transition-colors"
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 情绪氛围 */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">🌟 情绪氛围</h5>
                <div className="flex flex-wrap gap-2">
                  {MOOD_TAGS.map((mood) => (
                    <button
                      key={mood.label}
                      type="button"
                      onClick={() => addMoodTag(mood.value)}
                      className="px-3 py-1 text-sm bg-white hover:bg-orange-50 border border-orange-200 rounded-full transition-colors"
                    >
                      {mood.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 示例提示词 */}
        <div>
          <p className="text-sm text-gray-600 mb-2">💡 试试这些示例：</p>
          <div className="space-y-2">
            {examplePrompts.slice(0, 2).map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(example)}
                className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200/50"
                disabled={currentGeneration.isGenerating}
              >
                <div className="line-clamp-3">{example}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 高级设置 */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            <Settings className="w-4 h-4 mr-1" />
            高级设置
            <span className="ml-1">{showAdvanced ? '▼' : '▶'}</span>
          </button>
          
          {showAdvanced && selectedModel && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 图像比例 - 仅对支持的模型显示 */}
              {selectedModel.capabilities.supportsAspectRatio && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    图像比例
                  </label>
                  <select
                    value={currentConfig.aspectRatio || '1:1'}
                    onChange={(e) => {
                      updateConfig({ aspectRatio: e.target.value as any });
                    }}
                    className="input-field text-sm"
                    disabled={currentGeneration.isGenerating}
                  >
                    <option value="1:1">正方形 (1:1)</option>
                    <option value="16:9">横屏 (16:9)</option>
                    <option value="9:16">竖屏 (9:16)</option>
                    <option value="4:3">横版 (4:3)</option>
                    <option value="3:4">竖版 (3:4)</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  生成步数 ({currentConfig.numInferenceSteps || selectedModel.defaultConfig.numInferenceSteps})
                </label>
                <input
                  type="range"
                  min="1"
                  max={selectedModel.capabilities.maxSteps}
                  value={currentConfig.numInferenceSteps || selectedModel.defaultConfig.numInferenceSteps}
                  onChange={(e) => updateConfig({ numInferenceSteps: Number(e.target.value) })}
                  className="w-full"
                  disabled={currentGeneration.isGenerating}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>快速</span>
                  <span>高质量</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  输出格式
                </label>
                <select
                  value={currentConfig.outputFormat || 'webp'}
                  onChange={(e) => updateConfig({ outputFormat: e.target.value as any })}
                  className="input-field text-sm"
                  disabled={currentGeneration.isGenerating}
                >
                  {selectedModel.capabilities.supportedFormats.map((format) => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                      {format === 'webp' && ' (推荐)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 生成按钮 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!prompt.trim() || currentGeneration.isGenerating}
            className="btn-primary flex-1 flex items-center justify-center"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {currentGeneration.isGenerating ? '生成中...' : '生成图像'}
          </button>
          
          {currentGeneration.isGenerating && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >
              取消
            </button>
          )}
        </div>

        {/* 模型信息提示 */}
        {selectedModel && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            当前使用: <strong>{selectedModel.name}</strong> | 
            预计费用: <strong>${selectedModel.costPerGeneration?.toFixed(3)}</strong> | 
            生成数量: <strong>4张图像</strong>
          </div>
        )}
      </form>
    </div>
  );
} 