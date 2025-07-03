import React, { useState, useRef, useEffect } from 'react';
import { useAIGenerationStore } from '../store/aiGenerationStore';
import { AIService } from '../services/aiService';
import type { GenerationConfig } from '../types';

interface PromptInputProps {
  onGenerate?: (config: GenerationConfig) => void;
  disabled?: boolean;
  initialPrompt?: string;
  compact?: boolean;
}

// 艺术风格组（单选 - 避免风格冲突）
const ART_STYLE_TAGS = [
  { label: '摄影级逼真', value: 'photorealistic, hyperrealistic, professional photography' },
  { label: '油画风格', value: 'oil painting, classical art, brush strokes' },
  { label: '水彩画', value: 'watercolor painting, soft brushes, artistic' },
  { label: '动漫风格', value: 'anime style, manga, japanese animation' },
  { label: '像素艺术', value: 'pixel art, 8-bit, retro gaming style' },
  { label: '素描风格', value: 'pencil sketch, black and white, hand drawn' },
];

// 主题风格组（单选 - 避免主题冲突）
const THEME_STYLE_TAGS = [
  { label: '赛博朋克', value: 'cyberpunk, neon lights, futuristic city' },
  { label: '科幻场景', value: 'sci-fi, futuristic, space technology' },
  { label: '奇幻风格', value: 'fantasy, magical, mythical creatures' },
  { label: '蒸汽朋克', value: 'steampunk, vintage machinery, brass gears' },
  { label: '中国风', value: 'chinese style, traditional, elegant' },
  { label: '现代简约', value: 'modern, minimalist, clean design' },
];

// 情绪氛围组（单选 - 避免情绪冲突）
const MOOD_TAGS = [
  { label: '温暖明亮', value: 'warm lighting, bright, cheerful, golden hour' },
  { label: '神秘暗黑', value: 'dark, mysterious, moody lighting, shadows' },
  { label: '梦幻唯美', value: 'dreamy, ethereal, soft, beautiful, pastel' },
  { label: '震撼史诗', value: 'epic, dramatic, cinematic, powerful, grand' },
  { label: '宁静平和', value: 'peaceful, calm, serene, tranquil' },
  { label: '活力动感', value: 'energetic, dynamic, vibrant, lively' },
];

// 补充标签组（可多选 - 不冲突的增强属性）
const ENHANCEMENT_TAGS = [
  { label: '高细节', value: 'highly detailed, intricate details' },
  { label: '电影感', value: 'cinematic composition, film photography' },
  { label: '专业摄影', value: 'professional photography, studio lighting' },
  { label: '艺术大师', value: 'masterpiece, award winning' },
];

// 主题建议
const SUBJECT_SUGGESTIONS = [
  '美丽的风景画',
  '未来城市天际线',
  '可爱的动物',
  '科幻机器人',
  '奇幻生物',
  '抽象艺术',
  '人物肖像',
  '静物摄影',
];

// 质量增强词汇（作为独立属性）
const QUALITY_ENHANCEMENT = 'high quality, detailed, masterpiece, best quality, 4k resolution';

export function PromptInput({ onGenerate, disabled = false, initialPrompt = '', compact = false }: PromptInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // 每组只能选择一个（单选）
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>(''); // 艺术风格
  const [selectedThemeStyle, setSelectedThemeStyle] = useState<string>(''); // 主题风格  
  const [selectedMood, setSelectedMood] = useState<string>(''); // 情绪氛围
  
  // 补充标签可多选（不冲突）
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  
  const [isQualityEnhanced, setIsQualityEnhanced] = useState(false); // 品质增强独立存储
  const [showFullPrompt, setShowFullPrompt] = useState(false); // 是否显示完整提示词预览
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { startGeneration, currentConfig } = useAIGenerationStore();

  // 当initialPrompt变化时更新prompt
  useEffect(() => {
    setPrompt(initialPrompt);
    // 重置其他状态
    setSelectedArtStyle('');
    setSelectedThemeStyle('');
    setSelectedMood('');
    setSelectedEnhancements([]);
    setIsQualityEnhanced(false);
  }, [initialPrompt]);

  // 生成完整的提示词
  const getFullPrompt = (): string => {
    const parts = [prompt.trim()];
    
    // 添加选中的单选标签
    if (selectedArtStyle) parts.push(selectedArtStyle);
    if (selectedThemeStyle) parts.push(selectedThemeStyle);
    if (selectedMood) parts.push(selectedMood);
    
    // 添加选中的补充标签
    if (selectedEnhancements.length > 0) {
      parts.push(selectedEnhancements.join(', '));
    }

    // 添加品质增强
    if (isQualityEnhanced) {
      parts.push(QUALITY_ENHANCEMENT);
    }
    
    return parts.filter(part => part).join(', ');
  };

  // 处理提示词输入
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);
    
    // 自动调整文本框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // 选择艺术风格（单选）
  const selectArtStyle = (tagValue: string) => {
    setSelectedArtStyle(selectedArtStyle === tagValue ? '' : tagValue);
  };

  // 选择主题风格（单选）
  const selectThemeStyle = (tagValue: string) => {
    setSelectedThemeStyle(selectedThemeStyle === tagValue ? '' : tagValue);
  };

  // 选择情绪氛围（单选）
  const selectMood = (tagValue: string) => {
    setSelectedMood(selectedMood === tagValue ? '' : tagValue);
  };

  // 切换补充标签（多选）
  const toggleEnhancement = (tagValue: string) => {
    setSelectedEnhancements(prev => 
      prev.includes(tagValue) 
        ? prev.filter(tag => tag !== tagValue)
        : [...prev, tagValue]
    );
  };

  // 添加主题建议
  const addSubjectSuggestion = (subject: string) => {
    setPrompt(subject);
    setShowSuggestions(false);
  };

  // 切换品质增强
  const toggleQualityEnhancement = () => {
    setIsQualityEnhanced(prev => !prev);
  };

  // 清空所有内容
  const clearAll = () => {
    setPrompt('');
    setSelectedArtStyle('');
    setSelectedThemeStyle('');
    setSelectedMood('');
    setSelectedEnhancements([]);
    setIsQualityEnhanced(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // 开始生成
  const handleGenerate = async () => {
    const fullPrompt = getFullPrompt();
    console.log('🎯 PromptInput开始生成，fullPrompt:', fullPrompt);
    console.log('🎯 currentConfig:', currentConfig);
    
    if (!fullPrompt.trim() || disabled) return;

    const config: GenerationConfig = {
      ...currentConfig,
      prompt: fullPrompt.trim(),
    } as GenerationConfig;
    
    console.log('🎯 最终生成配置:', config);

    // 验证配置
    const validation = await AIService.validateConfig(config);
    if (!validation.isValid) {
      alert(`配置错误：${validation.errors.join(', ')}`);
      return;
    }

    // 显示警告信息
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('配置警告:', validation.warnings);
    }

    if (onGenerate) {
      console.log('🚀 调用外部onGenerate回调');
      onGenerate(config);
    } else {
      console.log('🚀 调用store的startGeneration');
      await startGeneration(config);
    }
  };

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const fullPrompt = getFullPrompt();
  const hasEnhancements = selectedArtStyle || selectedThemeStyle || selectedMood || 
                         selectedEnhancements.length > 0 || isQualityEnhanced;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* 主输入框 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder="描述你想要生成的图像... (支持 Ctrl+Enter 快速生成)"
          className="w-full min-h-[100px] max-h-[200px] p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
          disabled={disabled}
        />
        
        {/* 字符计数 */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {prompt.length}/1000
        </div>
      </div>

      {/* 操作按钮组 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          💡 主题建议
        </button>
        
        <button
          onClick={toggleQualityEnhancement}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            isQualityEnhanced 
              ? 'bg-green-500 text-white'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {isQualityEnhanced ? '✅ 已增强' : '✨ 增强品质'}
        </button>
        
        <button
          onClick={clearAll}
          disabled={!prompt.trim() && !hasEnhancements}
          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🗑️ 清空
        </button>

        {/* 预览完整提示词按钮 */}
        {hasEnhancements && (
          <button
            onClick={() => setShowFullPrompt(!showFullPrompt)}
            className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
          >
            {showFullPrompt ? '👁️ 隐藏预览' : '👁️ 预览完整'}
          </button>
        )}
      </div>

      {/* 完整提示词预览 */}
      {showFullPrompt && hasEnhancements && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-sm text-purple-700 font-medium mb-2">完整提示词预览：</div>
          <div className="text-sm text-gray-700 bg-white p-2 rounded border">
            {fullPrompt}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {fullPrompt.length}/1000 字符
          </div>
          
          {/* 增强项目详情 */}
          <div className="mt-3 space-y-2">
            {selectedArtStyle && (
              <div className="text-xs">
                <span className="text-blue-600 font-medium">🎨 艺术风格：</span>
                <span className="text-gray-600">{selectedArtStyle}</span>
              </div>
            )}
            {selectedThemeStyle && (
              <div className="text-xs">
                <span className="text-purple-600 font-medium">🌟 主题风格：</span>
                <span className="text-gray-600">{selectedThemeStyle}</span>
              </div>
            )}
            {selectedMood && (
              <div className="text-xs">
                <span className="text-orange-600 font-medium">😊 情绪氛围：</span>
                <span className="text-gray-600">{selectedMood}</span>
              </div>
            )}
            {selectedEnhancements.length > 0 && (
              <div className="text-xs">
                <span className="text-indigo-600 font-medium">✨ 效果增强：</span>
                <span className="text-gray-600">{selectedEnhancements.join(', ')}</span>
              </div>
            )}
            {isQualityEnhanced && (
              <div className="text-xs">
                <span className="text-green-600 font-medium">🔥 品质增强：</span>
                <span className="text-gray-600">{QUALITY_ENHANCEMENT}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 主题建议面板 */}
      {showSuggestions && (
        <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200">
          <h4 className="font-medium text-gray-800 mb-3">💡 主题建议</h4>
          <div className="grid grid-cols-2 gap-2">
            {SUBJECT_SUGGESTIONS.map((subject, index) => (
              <button
                key={index}
                onClick={() => addSubjectSuggestion(subject)}
                className="text-left p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 艺术风格组（单选） */}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center justify-between">
          <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>🎨 艺术风格 <span className="text-xs text-gray-500">(单选)</span></h4>
          {selectedArtStyle && (
            <span className="text-xs text-blue-600">已选择</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ART_STYLE_TAGS.map((tag, index) => (
            <button
              key={index}
              onClick={() => selectArtStyle(tag.value)}
              className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                selectedArtStyle === tag.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主题风格组（单选） */}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center justify-between">
          <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>🌟 主题风格 <span className="text-xs text-gray-500">(单选)</span></h4>
          {selectedThemeStyle && (
            <span className="text-xs text-purple-600">已选择</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {THEME_STYLE_TAGS.map((tag, index) => (
            <button
              key={index}
              onClick={() => selectThemeStyle(tag.value)}
              className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                selectedThemeStyle === tag.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 情绪氛围组（单选） */}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center justify-between">
          <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>😊 情绪氛围 <span className="text-xs text-gray-500">(单选)</span></h4>
          {selectedMood && (
            <span className="text-xs text-orange-600">已选择</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {MOOD_TAGS.map((tag, index) => (
            <button
              key={index}
              onClick={() => selectMood(tag.value)}
              className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                selectedMood === tag.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 效果增强组（可多选） */}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex items-center justify-between">
          <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>✨ 效果增强 <span className="text-xs text-gray-500">(可多选)</span></h4>
          {selectedEnhancements.length > 0 && (
            <span className="text-xs text-indigo-600">已选择 {selectedEnhancements.length} 个</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ENHANCEMENT_TAGS.map((tag, index) => (
            <button
              key={index}
              onClick={() => toggleEnhancement(tag.value)}
              className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                selectedEnhancements.includes(tag.value)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={!fullPrompt.trim() || disabled}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
      >
        😊 开始生成
      </button>
      
      <div className="text-center text-xs text-gray-500">
        提示：使用 Ctrl+Enter (Mac: Cmd+Enter) 快速生成
      </div>
    </div>
  );
} 