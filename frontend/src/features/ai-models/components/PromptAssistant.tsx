/**
 * AI驱动的智能提示词助手
 * 提供实时分析、优化建议、模板生成等功能
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { Lightbulb, TrendingUp, Zap, Target, Sparkles, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PromptOptimizer, PromptSuggestion, PromptAnalysis } from '../services/PromptOptimizer';

interface PromptAssistantProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  selectedModel: string;
  onTagsChange?: (tags: any) => void;
  onApplyOptimization?: (parsedResult: ParsedPromptResult) => void;
  onAIStateChange?: (state: { isAnalyzing: boolean; isOptimizing: boolean }) => void; // 新增：AI状态回调
  onAnalysisComplete?: (hasResult: boolean) => void; // 新增：分析完成回调
  triggerAnalysis?: boolean; // 新增：触发分析标志
  className?: string;
}

interface ParsedPromptResult {
  coreText: string;
  artStyle?: string;
  themeStyle?: string;
  mood?: string;
  technical: string[];
  composition: string[];
  enhancements: string[];
  qualityEnhanced: boolean;
  fullOptimizedPrompt?: string; // 🔥 新增：保留完整的优化提示词
}

interface ScoreDisplayProps {
  label: string;
  score: number;
  color: string;
  icon: React.ReactNode;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ label, score, color, icon }) => (
  <div className="flex items-center space-x-2">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${
            score >= 80 ? 'bg-green-500' : 
            score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  </div>
);

export const PromptAssistant: React.FC<PromptAssistantProps> = ({
  prompt,
  onPromptChange,
  selectedModel,
  onTagsChange,
  onApplyOptimization,
  onAIStateChange,
  onAnalysisComplete,
  triggerAnalysis = false,
  className = ''
}) => {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<PromptSuggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimization, setShowOptimization] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'suggestions' | 'templates'>('analysis');
  const [showOptimizationSuggestion, setShowOptimizationSuggestion] = useState(false); // 新增：显示优化建议
  const [isOptimizationApplied, setIsOptimizationApplied] = useState(false); // 新增：优化应用状态
  const [skipNextAnalysis, setSkipNextAnalysis] = useState(false); // 新增：跳过下次分析标记
  const [copySuccess, setCopySuccess] = useState(false); // 新增：复制成功状态
  const [outputLanguage, setOutputLanguage] = useState<'auto' | 'zh' | 'en'>('en'); // 🌐 默认英文输出

  const optimizer = PromptOptimizer.getInstance();

  // 智能解析优化后的提示词
  const parseOptimizedPrompt = (optimizedPrompt: string): ParsedPromptResult => {
    const result: ParsedPromptResult = {
      coreText: '',
      technical: [],
      composition: [],
      enhancements: [],
      qualityEnhanced: false
    };

    // 将提示词按逗号分割
    const parts = optimizedPrompt.split(',').map(part => part.trim()).filter(part => part);
    const unmatchedParts: string[] = [];

    // 模糊匹配函数：计算字符串相似度
    const calculateSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase();
      const s2 = str2.toLowerCase();
      
      // 检查包含关系
      if (s1.includes(s2) || s2.includes(s1)) return 0.8;
      
      // 检查关键词匹配
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(word => words2.includes(word));
      
      if (commonWords.length > 0) {
        return commonWords.length / Math.max(words1.length, words2.length);
      }
      
      return 0;
    };

    // 查找最佳匹配标签
    const findBestMatch = (input: string, tagValues: string[], threshold: number = 0.3) => {
      let bestMatch = '';
      let bestScore = 0;
      
      for (const tagValue of tagValues) {
        const score = calculateSimilarity(input, tagValue);
        if (score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = tagValue;
        }
      }
      
      return bestMatch;
    };

    // 定义标签关键词映射 - 基于PromptInput中的实际标签
    const tagMappings = {
      artStyle: {
        'photorealistic': 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed',
        'cinematic': 'cinematic photography, film photography, dramatic lighting, cinematic composition',
        'oil painting': 'oil painting, classical art, brush strokes, Renaissance style',
        'watercolor': 'watercolor painting, soft brushes, artistic, flowing colors',
        'anime': 'anime style, manga, japanese animation, cel shading',
        'pixel art': 'pixel art, 8-bit, retro gaming style, pixelated',
        'sketch': 'pencil sketch, black and white, hand drawn, charcoal drawing',
        'concept art': 'concept art, digital painting, matte painting, professional illustration',
        '3d': '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering',
        'impressionist': 'impressionist style, soft focus, painterly, artistic brushwork'
      },
      themeStyle: {
        'cyberpunk': 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets',
        'sci-fi': 'sci-fi, futuristic, space technology, holographic displays, advanced technology',
        'fantasy': 'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere',
        'steampunk': 'steampunk, vintage machinery, brass gears, Victorian era, industrial',
        'chinese': 'chinese style, traditional, elegant, ink wash painting, oriental aesthetics',
        'modern': 'modern, minimalist, clean design, sleek, contemporary',
        'retro': 'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave',
        'nature': 'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable',
        'industrial': 'industrial design, metallic textures, concrete, raw materials, urban decay',
        'gothic': 'gothic architecture, dark romantic, ornate details, mysterious atmosphere'
      },
      mood: {
        'warm': 'warm lighting, bright, cheerful, golden hour, soft sunlight',
        'dark': 'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro',
        'dreamy': 'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like',
        'epic': 'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring',
        'peaceful': 'peaceful, calm, serene, tranquil, meditation, zen atmosphere',
        'energetic': 'energetic, dynamic, vibrant, lively, high-energy, action-packed',
        'melancholic': 'melancholic, contemplative, nostalgic, bittersweet, introspective',
        'luxurious': 'luxurious, elegant, sophisticated, premium, high-end, glamorous',
        'wild': 'wild, primal, untamed, rugged, natural, raw power',
        'futuristic': 'futuristic, high-tech, digital, cyber, holographic, technological'
      },
      technical: [
        { keywords: ['85mm', 'portrait lens'], value: '85mm lens, portrait lens, shallow depth of field' },
        { keywords: ['wide-angle', '24mm'], value: 'wide-angle lens, 24mm, expansive view, environmental context' },
        { keywords: ['macro', 'close-up'], value: 'macro photography, extreme close-up, intricate details, magnified' },
        { keywords: ['telephoto', '200mm'], value: 'telephoto lens, 200mm, compressed perspective, background blur' },
        { keywords: ['fisheye'], value: 'fisheye lens, distorted perspective, 180-degree view, curved edges' },
        { keywords: ['shallow depth', 'bokeh', 'f/1.4'], value: 'shallow depth of field, f/1.4, bokeh effect, selective focus' },
        { keywords: ['deep focus', 'f/11'], value: 'deep focus, f/11, everything in focus, landscape photography' },
        { keywords: ['golden hour'], value: 'golden hour lighting, warm sunlight, magic hour, soft shadows' },
        { keywords: ['blue hour', 'twilight'], value: 'blue hour, twilight, evening atmosphere, city lights' },
        { keywords: ['studio lighting'], value: 'studio lighting, softbox, professional lighting setup, controlled environment' }
      ],
      composition: [
        { keywords: ['rule of thirds'], value: 'rule of thirds, balanced composition, dynamic framing' },
        { keywords: ['centered', 'symmetrical'], value: 'centered composition, symmetrical, balanced, focal point' },
        { keywords: ['low angle'], value: 'low angle shot, worm eye view, heroic perspective, dramatic angle' },
        { keywords: ['high angle', 'overhead'], value: 'high angle shot, bird eye view, overhead perspective, aerial view' },
        { keywords: ['close-up shot'], value: 'close-up shot, intimate framing, detailed focus, emotional connection' },
        { keywords: ['wide shot'], value: 'wide shot, establishing shot, environmental context, full scene' },
        { keywords: ['medium shot'], value: 'medium shot, upper body, conversational framing, portrait style' },
        { keywords: ['extreme close-up'], value: 'extreme close-up, macro detail, textural focus, intimate detail' },
        { keywords: ['dynamic'], value: 'dynamic composition, diagonal lines, movement, energy' },
        { keywords: ['minimalist'], value: 'minimalist composition, negative space, clean lines, simple elegance' }
      ],
      enhancements: [
        { keywords: ['highly detailed', 'intricate details', 'ultra-detailed'], value: 'highly detailed, intricate details, ultra-detailed textures, photorealistic details' },
        { keywords: ['cinematic composition'], value: 'cinematic composition, film photography, movie-like quality, Hollywood style' },
        { keywords: ['professional photography'], value: 'professional photography, studio quality, commercial grade, award-winning' },
        { keywords: ['masterpiece', 'award winning'], value: 'masterpiece, award winning, gallery quality, museum piece' },
        { keywords: ['volumetric lighting'], value: 'volumetric lighting, god rays, atmospheric lighting, light beams' },
        { keywords: ['color grading'], value: 'color grading, cinematic colors, film look, professional color correction' },
        { keywords: ['hdr'], value: 'HDR photography, high dynamic range, enhanced contrast, vivid colors' },
        { keywords: ['film grain'], value: 'film grain, analog photography, vintage film look, organic texture' }
      ]
    };

    // 质量增强关键词
    const qualityKeywords = ['high quality', 'detailed', 'masterpiece', 'best quality', '4k resolution'];

    // 处理每个部分 - 使用智能匹配算法
    for (const part of parts) {
      let matched = false;
      const lowerPart = part.toLowerCase();

      console.log('🔍 解析部分:', part); // 🎯 调试日志

      // 检查是否是质量增强
      if (qualityKeywords.some(keyword => lowerPart.includes(keyword))) {
        result.qualityEnhanced = true;
        matched = true;
        console.log('✅ 匹配质量增强:', part);
        continue;
      }

      // 智能匹配艺术风格 - 提高匹配阈值避免过度匹配
      const artStyleMatch = findBestMatch(part, Object.values(tagMappings.artStyle), 0.5);
      if (artStyleMatch) {
        result.artStyle = artStyleMatch;
        matched = true;
        console.log('✅ 匹配艺术风格:', part, '->', artStyleMatch);
        continue;
      }

      // 智能匹配主题风格 - 提高匹配阈值
      const themeStyleMatch = findBestMatch(part, Object.values(tagMappings.themeStyle), 0.5);
      if (themeStyleMatch) {
        result.themeStyle = themeStyleMatch;
        matched = true;
        console.log('✅ 匹配主题风格:', part, '->', themeStyleMatch);
        continue;
      }

      // 智能匹配情绪氛围 - 提高匹配阈值
      const moodMatch = findBestMatch(part, Object.values(tagMappings.mood), 0.5);
      if (moodMatch) {
        result.mood = moodMatch;
        matched = true;
        console.log('✅ 匹配情绪氛围:', part, '->', moodMatch);
        continue;
      }

      // 智能匹配技术参数
      const techMatch = findBestMatch(part, tagMappings.technical.map(t => t.value), 0.4);
      if (techMatch && !result.technical.includes(techMatch)) {
        result.technical.push(techMatch);
        matched = true;
        console.log('✅ 匹配技术参数:', part, '->', techMatch);
        continue;
      }

      // 智能匹配构图参数
      const compMatch = findBestMatch(part, tagMappings.composition.map(c => c.value), 0.4);
      if (compMatch && !result.composition.includes(compMatch)) {
        result.composition.push(compMatch);
        matched = true;
        console.log('✅ 匹配构图参数:', part, '->', compMatch);
        continue;
      }

      // 智能匹配效果增强 - 提高匹配阈值防止过度匹配
      const enhMatch = findBestMatch(part, tagMappings.enhancements.map(e => e.value), 0.6);
      if (enhMatch && !result.enhancements.includes(enhMatch)) {
        result.enhancements.push(enhMatch);
        matched = true;
        console.log('✅ 匹配效果增强:', part, '->', enhMatch);
        continue;
      }

      // 如果没有匹配到任何标签，认为是核心描述文本
      if (!matched) {
        unmatchedParts.push(part);
        console.log('⭕ 未匹配，加入核心文本:', part);
      }
    }

    console.log('🧠 解析结果:', result);

    // 构建核心文本（未匹配的部分）
    result.coreText = unmatchedParts.join(', ');

    return result;
  };

  // 防抖的分析函数
  const debouncedAnalyze = useCallback(
    debounce(async (promptText: string) => {
      if (!promptText.trim()) {
        setAnalysis(null);
        setShowOptimizationSuggestion(false);
        return;
      }

      setIsAnalyzing(true);
      try {
        const result = await optimizer.analyzePrompt(promptText);
        setAnalysis(result);
        
        // 🎯 智能优化提醒 - 如果总体评分低于90分，显示优化建议
        if (result.overall < 90) {
          setShowOptimizationSuggestion(true);
        } else {
          setShowOptimizationSuggestion(false);
        }
      } catch (error) {
        console.error('❌ 分析失败:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 500),
    [optimizer]
  );

  // 🔥 移除自动分析逻辑，改为用户主动触发
  // 监听提示词变化，自动分析 - 已移除，交给用户主动控制
  // useEffect(() => {
  //   debouncedAnalyze(prompt);
  //   return () => debouncedAnalyze.cancel();
  // }, [prompt, debouncedAnalyze]);

  // 🔥 移除自动分析逻辑，完全由用户主动控制
  // 保持简洁，不自动触发任何分析

  // 🎯 监听triggerAnalysis标志，当用户点击AI助手按钮时触发分析
  useEffect(() => {
    if (triggerAnalysis && prompt.trim() && !analysis && !isAnalyzing) {
      console.log('🤖 触发AI助手分析:', prompt);
      // 执行分析
      const performAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          const result = await optimizer.analyzePrompt(prompt);
          setAnalysis(result);
          
          // 通知父组件分析完成
          if (onAnalysisComplete) {
            onAnalysisComplete(true);
          }
          
          // 🎯 智能优化提醒 - 如果总体评分低于90分，显示优化建议
          if (result.overall < 90) {
            setShowOptimizationSuggestion(true);
          } else {
            setShowOptimizationSuggestion(false);
          }
        } catch (error) {
          console.error('❌ 分析失败:', error);
          // 通知父组件分析失败
          if (onAnalysisComplete) {
            onAnalysisComplete(false);
          }
        } finally {
          setIsAnalyzing(false);
        }
      };
      
      performAnalysis();
    }
  }, [triggerAnalysis, prompt, analysis, isAnalyzing, optimizer, onAnalysisComplete]);

  // 🎯 监听AI状态变化，通知父组件
  useEffect(() => {
    if (onAIStateChange) {
      onAIStateChange({ isAnalyzing, isOptimizing });
    }
  }, [isAnalyzing, isOptimizing, onAIStateChange]);

  // 手动优化提示词
  const handleOptimize = async () => {
    if (!prompt.trim()) return;

    setIsOptimizing(true);
    setShowOptimization(true);
    onAIStateChange?.({ isAnalyzing, isOptimizing: true });
    
    try {
      console.log('🚀 开始提示词优化，包含分析结果:', analysis);
      
      // 🔥 关键修复：传递之前的分析结果
      const optimization = await optimizer.optimizePrompt(
        prompt, 
        selectedModel || 'flux-schnell',
        {
          style: 'balanced',
          focus: 'quality',
          language: outputLanguage, // 🌐 使用用户选择的语言
          previousAnalysis: analysis || undefined // 🔥 传递分析结果
        }
      );
      
      setSuggestions(optimization);
      setIsOptimizationApplied(false);
      

      
    } catch (error) {
      console.error('❌ 优化失败:', error);
      // 可以添加错误提示
    } finally {
      setIsOptimizing(false);
      onAIStateChange?.({ isAnalyzing, isOptimizing: false });
    }
  };



  // 🎯 智能分离核心描述和标签内容
  const separateCorePromptAndTags = (optimizedPrompt: string) => {
    // 🔍 更精确的标签识别策略
    const technicalTags = [
      // 摄影技术
      'mm lens', 'photography', 'shot', 'angle', 'camera', 'f/', 'iso',
      'depth of field', 'bokeh', 'focus', 'blur', 'sharp', 'macro',
      // 光照技术  
      'lighting', 'light', 'golden hour', 'soft light', 'hard light',
      'natural light', 'studio lighting', 'volumetric lighting',
      // 质量增强
      'highly detailed', 'ultra detailed', 'masterpiece', 'professional quality',
      'award winning', 'ultra high resolution', '8k', '4k', 'hdr',
      // 艺术风格
      'oil painting', 'watercolor', 'digital art', 'concept art',
      'photorealistic', 'hyperrealistic', 'cinematic'
    ];

    const qualityModifiers = [
      'ultra', 'highly', 'extremely', 'very', 'super', 'hyper',
      'professional', 'award-winning', 'gallery', 'museum'
    ];

    // 分离策略：基于语义而非关键词匹配
    const parts = optimizedPrompt.split(/,\s*/);
    const coreDescriptionParts: string[] = [];
    const technicalTagParts: string[] = [];

    parts.forEach((part, index) => {
      const trimmedPart = part.trim();
      
      // 🇨🇳 中文内容直接归类为核心描述
      if (/[\u4e00-\u9fa5]/.test(trimmedPart)) {
        coreDescriptionParts.push(trimmedPart);
        return;
      }

      // 🔍 技术标签检测（更精确）
      const isTechnicalTag = technicalTags.some(tag => 
        trimmedPart.toLowerCase().includes(tag.toLowerCase())
      );

      // 🔍 质量修饰词检测
      const isQualityModifier = qualityModifiers.some(modifier =>
        trimmedPart.toLowerCase().includes(modifier.toLowerCase())
      );

      // 🔍 短标签检测（纯技术词汇）
      const isShortTechnicalTag = trimmedPart.length <= 20 && 
        /^[a-zA-Z\s\d-]+$/.test(trimmedPart) &&
        (trimmedPart.includes('mm') || trimmedPart.includes('k') || 
         trimmedPart.includes('f/') || trimmedPart.includes('iso'));

      if (isTechnicalTag || isQualityModifier || isShortTechnicalTag) {
        technicalTagParts.push(trimmedPart);
      } else {
        // 🎯 对于英文内容，采用位置+长度策略
        // 前3个部分更可能是核心描述，后面的更可能是技术标签
        if (index < 3 || trimmedPart.length > 25) {
          coreDescriptionParts.push(trimmedPart);
        } else {
          technicalTagParts.push(trimmedPart);
        }
      }
    });

    const corePrompt = coreDescriptionParts.join(', ').trim();
    const detectedTags = technicalTagParts.join(', ').trim();

    // 🛡️ 安全检查：确保至少有一半内容保留为核心描述
    if (corePrompt.length < optimizedPrompt.length * 0.3) {
      console.warn('⚠️ 核心描述过少，回退到完整提示词');
      return {
        corePrompt: optimizedPrompt,
        detectedTags: ''
      };
    }

    return { corePrompt, detectedTags };
  };

  // 应用优化后的提示词
  const applyOptimizedPrompt = () => {
    if (suggestions?.optimizedPrompt) {
      // 🎯 设置跳过下次分析，避免重复分析
      setSkipNextAnalysis(true);
      
      if (onApplyOptimization) {
        // 🎯 新功能：分离核心描述和标签
        const { corePrompt, detectedTags } = separateCorePromptAndTags(suggestions.optimizedPrompt);
        
        console.log('🔍 提示词分离结果:', {
          original: suggestions.optimizedPrompt,
          corePrompt,
          detectedTags,
          suggestedTags: suggestions.suggestedTags
        });

        // 🎯 使用分离后的核心描述作为提示词框内容
        const parsedResult: ParsedPromptResult = {
          coreText: corePrompt || suggestions.optimizedPrompt, // 如果分离失败，使用原始内容
          artStyle: suggestions.suggestedTags?.artStyle,
          themeStyle: suggestions.suggestedTags?.themeStyle,
          mood: suggestions.suggestedTags?.mood,
          technical: suggestions.suggestedTags?.technical || [],
          composition: suggestions.suggestedTags?.composition || [],
          enhancements: suggestions.suggestedTags?.enhancement || [],
          qualityEnhanced: false, // 由于是优化后的文本，不需要额外的质量增强
          fullOptimizedPrompt: suggestions.optimizedPrompt // 🔥 保留完整的优化提示词，供生成时使用
        };
        
        console.log('🧠 AI优化应用结果:', parsedResult);
        console.log('🏷️ 原始标签建议:', suggestions.suggestedTags);
        onApplyOptimization(parsedResult);
      } else {
        // 降级到原有行为：只提取核心描述部分
        const { corePrompt } = separateCorePromptAndTags(suggestions.optimizedPrompt);
        onPromptChange(corePrompt || suggestions.optimizedPrompt);
      }
      setShowOptimization(false);
      setIsOptimizationApplied(true); // 🎯 标记优化已应用
      setShowOptimizationSuggestion(false); // 隐藏优化建议
      
      // 3秒后重置应用状态
      setTimeout(() => {
        setIsOptimizationApplied(false);
      }, 3000);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true); // 🎯 显示复制成功
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000); // 2秒后重置
    } catch (error) {
      console.error('复制失败:', error);
      // 这里可以添加失败提示
    }
  };

  // 获取总体评分颜色
  const getOverallScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // 渲染分析结果
  const renderAnalysis = () => {
    if (!analysis) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>输入提示词开始智能分析</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 总体评分 */}
        <div className="text-center">
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${getOverallScoreColor(analysis.overall)}`}>
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="font-bold text-lg">总体评分: {analysis.overall}</span>
          </div>
        </div>

        {/* 🎯 智能优化建议 - 分数低于70分时显示 */}
        {showOptimizationSuggestion && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Lightbulb className="w-5 h-5 mr-2 text-orange-500" />
                <span className="text-sm font-medium text-orange-800">
                  建议使用AI优化提升质量
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab('suggestions');
                  handleOptimize(); // 🎯 自动执行优化
                }}
                disabled={isOptimizing || !prompt.trim()}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white disabled:opacity-50"
              >
                {isOptimizing ? '优化中...' : '立即优化'}
              </Button>
            </div>
            <p className="text-xs text-orange-700 mt-2">
              当前提示词评分偏低，AI优化可以帮助您提升图像生成质量
            </p>
          </div>
        )}

        {/* 详细评分 */}
        <div className="grid grid-cols-1 gap-3">
          <ScoreDisplay
            label="清晰度"
            score={analysis.clarity}
            color="bg-blue-100 text-blue-600"
            icon={<Target className="w-4 h-4" />}
          />
          <ScoreDisplay
            label="具体性"
            score={analysis.specificity}
            color="bg-purple-100 text-purple-600"
            icon={<Zap className="w-4 h-4" />}
          />
          <ScoreDisplay
            label="创意性"
            score={analysis.creativity}
            color="bg-pink-100 text-pink-600"
            icon={<Sparkles className="w-4 h-4" />}
          />
          <ScoreDisplay
            label="技术完整性"
            score={analysis.technical}
            color="bg-green-100 text-green-600"
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        {/* 优势和不足 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.strengths.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                优势
              </h4>
              <ul className="text-sm text-green-700 space-y-1">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.weaknesses.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                <Target className="w-4 h-4 mr-1" />
                待改进
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {analysis.weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 改进建议 */}
        {analysis.suggestions && analysis.suggestions.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
              <Lightbulb className="w-4 h-4 mr-1" />
              改进建议
            </h4>
            <ul className="text-sm text-blue-700 space-y-2">
              {analysis.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start">
                  <ChevronRight className="w-4 h-4 mr-1 mt-0.5 text-blue-500 flex-shrink-0" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // 渲染优化建议
  const renderOptimization = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
            AI智能优化
          </h3>
          <div className="flex items-center space-x-4">
            {/* 🌐 语言选择器 */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">输出语言:</span>
              <select
                value={outputLanguage}
                onChange={(e) => {
                  setOutputLanguage(e.target.value as 'auto' | 'zh' | 'en');
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="en">🇺🇸 英文(推荐)</option>
                <option value="zh">🇨🇳 中英混合</option>
                <option value="auto">🤖 智能识别</option>
              </select>
            </div>
            
            <Button
              onClick={handleOptimize}
              disabled={isOptimizing || !prompt.trim()}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? '优化中...' : '开始优化'}</span>
            </Button>
          </div>
        </div>

        {/* 💡 AI优化说明 - 移到顶部，增加间距 */}
        <div className="text-sm text-gray-600 bg-amber-50 p-4 rounded-lg border-l-4 border-amber-200">
          <strong>💡 优化建议：</strong>
          英文提示词生图效果更佳，AI模型对英文理解更准确，能生成更高质量的图像。应用优化后可在提示词框下方获取中文翻译。
        </div>

        {showOptimization && suggestions && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border space-y-5">
            {/* 置信度显示 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">AI优化置信度</span>
              <div className="flex items-center space-x-3">
                <div className="w-28 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${suggestions.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-800">{suggestions.confidence}%</span>
              </div>
            </div>

            {/* 优化后的提示词 */}
            <div className="bg-white p-5 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 text-base">优化后的提示词</h4>
                <div className="flex space-x-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(suggestions.optimizedPrompt)}
                    disabled={copySuccess}
                    className={`${copySuccess ? 'bg-green-50 border-green-200 text-green-600' : ''} transition-all duration-200`}
                  >
                    {copySuccess ? (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        已复制
                      </div>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyOptimizedPrompt}
                    disabled={isOptimizationApplied}
                    className={`${
                      isOptimizationApplied
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                    } transition-all duration-200`}
                  >
                    {isOptimizationApplied ? (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        已应用
                      </div>
                    ) : (
                      '立即应用'
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed text-sm bg-gray-50 p-3 rounded border">{suggestions.optimizedPrompt}</p>
            </div>

            {/* 改进说明 */}
            {suggestions.improvements.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 text-base">改进要点</h4>
                <ul className="space-y-2">
                  {suggestions.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 bg-white p-3 rounded border-l-4 border-purple-200">
                      <ChevronRight className="w-4 h-4 mr-2 mt-0.5 text-purple-500 flex-shrink-0" />
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 优化理由 */}
            {suggestions.reasoning && (
              <div className="text-sm text-gray-600 bg-white/80 p-4 rounded-lg border">
                <strong className="text-gray-800">优化思路：</strong> 
                <span className="ml-2">{suggestions.reasoning}</span>
              </div>
            )}
            
            {/* 🌐 语言策略说明 */}
            <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-200">
              <strong className="text-blue-800">💡 语言策略提示：</strong>
              <div className="mt-1">
                {outputLanguage === 'en' && ' 🔥 英文模式(推荐)：最佳AI生成效果，提供中文翻译帮助理解'}
                {outputLanguage === 'zh' && ' 中英混合模式：保持中文创意表达 + 英文专业标签，兼顾理解性和效果'}
                {outputLanguage === 'auto' && ' 智能识别输入语言，根据内容自动选择最适合的输出方式'}
              </div>
            </div>
          </div>
        )}

        {!showOptimization && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-base">点击"开始优化"获取AI智能建议</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border p-6 ${className}`}>
      {/* 标签页导航 */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'analysis'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          实时分析
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'suggestions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          AI优化
        </button>
      </div>

      {/* 分析状态指示器 */}
      {isAnalyzing && (
        <div className="flex items-center justify-center py-4 text-blue-600">
          <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
          <span>正在分析提示词...</span>
        </div>
      )}

      {/* 标签页内容 */}
      <div className="min-h-[300px]">
        {activeTab === 'analysis' && !isAnalyzing && renderAnalysis()}
        {activeTab === 'suggestions' && renderOptimization()}
      </div>
    </div>
  );
}; 