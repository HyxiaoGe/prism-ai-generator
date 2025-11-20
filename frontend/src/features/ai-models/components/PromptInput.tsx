import React, { useState, useRef, useEffect } from 'react';
import { useAIGenerationStore } from '../../../store/aiGenerationStore';
import { useAuthStore } from '../../../store/authStore';
import { AIService } from '../services/aiService';
import { PromptAssistant } from './PromptAssistant';
import { TagSelectorGroup } from './TagSelectorGroup';
import { SubjectSuggestionsPanel } from './SubjectSuggestionsPanel';
import { SceneTemplateBrowser } from './SceneTemplateBrowser';
import type { GenerationConfig } from '../../../types';
import type { SceneTemplate } from '../../../types/database';
import {
  ART_STYLE_TAGS,
  THEME_STYLE_TAGS,
  MOOD_TAGS,
  TECHNICAL_TAGS,
  COMPOSITION_TAGS,
  ENHANCEMENT_TAGS,
  SCENE_TEMPLATES,
  SUBJECT_SUGGESTIONS,
  QUALITY_ENHANCEMENT,
  ALL_TAG_GROUPS,
  getDisplayValue,
} from '../../../constants/tags';

interface PromptInputProps {
  onGenerate?: (config: GenerationConfig) => void;
  disabled?: boolean;
  initialPrompt?: string;
  compact?: boolean;
  suggestedTags?: any;
  parsedFeatures?: any; // 新增：解析出的特征信息，用于自动选择标签
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

export function PromptInput({ onGenerate, disabled = false, initialPrompt = '', compact = false, suggestedTags, parsedFeatures }: PromptInputProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // 每组只能选择一个（单选）
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>(''); // 艺术风格
  const [selectedThemeStyle, setSelectedThemeStyle] = useState<string>(''); // 主题风格  
  const [selectedMood, setSelectedMood] = useState<string>(''); // 情绪氛围
  
  // 补充标签可多选（不冲突）
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  
  // 新增的多选组
  const [selectedTechnical, setSelectedTechnical] = useState<string[]>([]); // 技术参数
  const [selectedComposition, setSelectedComposition] = useState<string[]>([]); // 构图参数
  // selectedNegative 已移除 - 负面提示词功能已删除
  
  const [isQualityEnhanced, setIsQualityEnhanced] = useState(false); // 品质增强独立存储
  const [showFullPrompt, setShowFullPrompt] = useState(false); // 是否显示完整提示词预览
  // showAdvanced 已移除 - 高级选项功能已删除
  const [showTemplates, setShowTemplates] = useState(false); // 是否显示场景模板
  const [selectedTemplate, setSelectedTemplate] = useState(''); // 选中的场景模板
  const [showAIAssistant, setShowAIAssistant] = useState(false); // 是否显示AI助手
  const [aiSuggestedTags, setAiSuggestedTags] = useState<any>({}); // AI建议的标签
  const [aiState, setAiState] = useState({ isAnalyzing: false, isOptimizing: false }); // AI状态
  const [hasAnalysisResult, setHasAnalysisResult] = useState(false); // 是否已有分析结果
  const [fullOptimizedPrompt, setFullOptimizedPrompt] = useState<string | null>(null); // 🔥 保存完整的优化提示词
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { startGeneration, currentConfig } = useAIGenerationStore();
  const { appUser } = useAuthStore();

  // 🌐 新增：翻译相关状态
  const [showTranslation, setShowTranslation] = useState(false); // 是否显示翻译
  const [translation, setTranslation] = useState<any>(null); // 翻译结果
  const [isTranslating, setIsTranslating] = useState(false); // 翻译状态
  const [triggerAnalysis, setTriggerAnalysis] = useState(false); // 触发分析标志

  // 当initialPrompt变化时更新prompt
  useEffect(() => {
    setPrompt(initialPrompt);
    // 重置其他状态
    setSelectedArtStyle('');
    setSelectedThemeStyle('');
    setSelectedMood('');
    setSelectedEnhancements([]);
    setSelectedTechnical([]);
    setSelectedComposition([]);
    // setSelectedNegative([]);
    setIsQualityEnhanced(false);
    setSelectedTemplate('');
  }, [initialPrompt]);

  // 🎯 智能标签解析 - 根据parsedFeatures自动选择对应的标签
  useEffect(() => {
    if (!parsedFeatures) return;
    
    // 辅助函数：根据标签显示值查找对应的value
    const findTagValueByLabel = (label: string, tagGroups: any[]): string => {
      for (const group of tagGroups) {
        const tag = group.find((tag: any) => tag.displayValue === label || tag.label === label);
        if (tag) return tag.value;
      }
      return '';
    };
    
    // 设置艺术风格（单选）
    if (parsedFeatures.artStyle) {
      const artStyleValue = findTagValueByLabel(parsedFeatures.artStyle.label, [ART_STYLE_TAGS]);
      if (artStyleValue) {
        setSelectedArtStyle(artStyleValue);
      }
    }
    
    // 设置主题风格（单选）
    if (parsedFeatures.themeStyle) {
      const themeStyleValue = findTagValueByLabel(parsedFeatures.themeStyle.label, [THEME_STYLE_TAGS]);
      if (themeStyleValue) {
        setSelectedThemeStyle(themeStyleValue);
      }
    }
    
    // 设置情绪氛围（单选）
    if (parsedFeatures.mood) {
      const moodValue = findTagValueByLabel(parsedFeatures.mood.label, [MOOD_TAGS]);
      if (moodValue) {
        setSelectedMood(moodValue);
      }
    }
    
    // 设置增强效果（多选）
    if (parsedFeatures.enhancements && parsedFeatures.enhancements.length > 0) {
      const enhancementValues: string[] = [];
      const technicalValues: string[] = [];
      const compositionValues: string[] = [];
      
      for (const enhancement of parsedFeatures.enhancements) {
        // 先在增强效果中查找
        const enhancementValue = findTagValueByLabel(enhancement.label, [ENHANCEMENT_TAGS]);
        if (enhancementValue) {
          enhancementValues.push(enhancementValue);
          continue;
        }
        
        // 在技术参数中查找
        const technicalValue = findTagValueByLabel(enhancement.label, [TECHNICAL_TAGS]);
        if (technicalValue) {
          technicalValues.push(technicalValue);
          continue;
        }
        
        // 在构图参数中查找
        const compositionValue = findTagValueByLabel(enhancement.label, [COMPOSITION_TAGS]);
        if (compositionValue) {
          compositionValues.push(compositionValue);
        }
      }
      
      if (enhancementValues.length > 0) {
        setSelectedEnhancements(enhancementValues);
      }
      
      if (technicalValues.length > 0) {
        setSelectedTechnical(technicalValues);
      }
      
      if (compositionValues.length > 0) {
        setSelectedComposition(compositionValues);
      }
    }
    
    // 设置品质增强
    if (parsedFeatures.qualityEnhanced) {
      setIsQualityEnhanced(true);
    }
    
  }, [parsedFeatures]);

  // 当suggestedTags变化时应用推荐标签
  useEffect(() => {
    if (suggestedTags) {
      
      // 应用艺术风格
      if (suggestedTags.artStyle) {
        setSelectedArtStyle(suggestedTags.artStyle);
      }
      
      // 应用主题风格
      if (suggestedTags.themeStyle) {
        setSelectedThemeStyle(suggestedTags.themeStyle);
      }
      
      // 应用情绪氛围
      if (suggestedTags.mood) {
        setSelectedMood(suggestedTags.mood);
      }
      
      // 应用技术参数
      if (suggestedTags.technical && Array.isArray(suggestedTags.technical)) {
        setSelectedTechnical(suggestedTags.technical);
      }
      
      // 应用构图参数
      if (suggestedTags.composition && Array.isArray(suggestedTags.composition)) {
        setSelectedComposition(suggestedTags.composition);
      }
      
      // 应用效果增强
      if (suggestedTags.enhancements && Array.isArray(suggestedTags.enhancements)) {
        setSelectedEnhancements(suggestedTags.enhancements);
      }
      
      // 高级选项自动开启逻辑已移除 - 功能已删除
      
      // 自动开启品质增强
      setIsQualityEnhanced(true);
    }
  }, [suggestedTags]);

  // 生成完整的提示词
  const getFullPrompt = (): string => {
    const parts = [prompt.trim()];
    
    // 添加选中的单选标签
    if (selectedArtStyle) parts.push(selectedArtStyle);
    if (selectedThemeStyle) parts.push(selectedThemeStyle);
    if (selectedMood) parts.push(selectedMood);
    
    // 添加选中的技术参数
    if (selectedTechnical.length > 0) {
      parts.push(selectedTechnical.join(', '));
    }
    
    // 添加选中的构图参数
    if (selectedComposition.length > 0) {
      parts.push(selectedComposition.join(', '));
    }
    
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

  // getNegativePrompt 已移除 - 负面提示词功能已删除

  // 处理提示词输入
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);
    
    // 🔥 用户手动修改提示词时，清空优化提示词（因为不再适用）
    if (fullOptimizedPrompt) {
      setFullOptimizedPrompt(null);
      console.log('🔥 用户手动修改提示词，清空优化提示词');
    }
    
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

  // 切换技术参数（多选）
  const toggleTechnical = (tagValue: string) => {
    setSelectedTechnical(prev => 
      prev.includes(tagValue) 
        ? prev.filter(tag => tag !== tagValue)
        : [...prev, tagValue]
    );
  };

  // 切换构图参数（多选）
  const toggleComposition = (tagValue: string) => {
    setSelectedComposition(prev => 
      prev.includes(tagValue) 
        ? prev.filter(tag => tag !== tagValue)
        : [...prev, tagValue]
    );
  };

  // toggleNegative 已移除 - 负面提示词功能已删除

  // 添加主题建议
  const addSubjectSuggestion = (subject: string) => {
    setPrompt(subject);
    setShowSuggestions(false);
  };

  // 应用场景模板
  const applySceneTemplate = (template: SceneTemplate) => {
    // 设置基础提示词
    setPrompt(template.base_prompt);
    setSelectedTemplate(template.id);
    setShowTemplates(false);

    // 应用建议的标签（如果有）
    if (template.suggested_tags) {
      // 艺术风格
      if (template.suggested_tags.art_style && template.suggested_tags.art_style.length > 0) {
        setSelectedArtStyle(template.suggested_tags.art_style[0]);
      }

      // 主题风格
      if (template.suggested_tags.theme_style && template.suggested_tags.theme_style.length > 0) {
        setSelectedThemeStyle(template.suggested_tags.theme_style[0]);
      }

      // 情绪氛围
      if (template.suggested_tags.mood && template.suggested_tags.mood.length > 0) {
        setSelectedMood(template.suggested_tags.mood[0]);
      }

      // 技术参数
      if (template.suggested_tags.technical && template.suggested_tags.technical.length > 0) {
        setSelectedTechnical(template.suggested_tags.technical);
      }

      // 构图参数
      if (template.suggested_tags.composition && template.suggested_tags.composition.length > 0) {
        setSelectedComposition(template.suggested_tags.composition);
      }

      // 增强属性
      if (template.suggested_tags.enhancement && template.suggested_tags.enhancement.length > 0) {
        // 检查是否包含品质增强
        const hasQuality = template.suggested_tags.enhancement.some(tag =>
          tag.toLowerCase().includes('quality')
        );
        setIsQualityEnhanced(hasQuality);
      }
    }
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
    setSelectedTechnical([]);
    setSelectedComposition([]);
    // setSelectedNegative([]);
    setIsQualityEnhanced(false);
    setSelectedTemplate('');
    setAiSuggestedTags({});
    setHasAnalysisResult(false); // 重置分析状态
    setFullOptimizedPrompt(null); // 🔥 清空完整优化提示词
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // 处理AI助手按钮点击
  const handleAIAssistantToggle = () => {
    const newShowState = !showAIAssistant;
    setShowAIAssistant(newShowState);
    
    // 🎯 当用户点击显示AI助手时，如果有提示词但没有分析结果，主动触发分析
    if (newShowState && prompt.trim() && !hasAnalysisResult && !aiState.isAnalyzing) {
      console.log('🤖 用户打开AI助手，准备自动分析提示词:', prompt);
      // 通过设置一个标志来触发分析
      setTriggerAnalysis(true);
    }
  };

  // 🌐 新增：处理翻译功能
  const handleTranslation = async () => {
    if (!fullOptimizedPrompt || isTranslating) return;
    
    setIsTranslating(true);
    try {
      const response = await fetch('/.netlify/functions/translate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          englishPrompt: fullOptimizedPrompt
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setTranslation(result);
        setShowTranslation(true);
      }
    } catch (error) {
      console.error('翻译失败:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // 处理AI建议的标签
  const handleAITagSuggestions = (suggestedTags: any) => {
    setAiSuggestedTags(suggestedTags);
    
    // 根据AI建议自动选择相应的标签
    if (suggestedTags.artStyle) {
      const matchingTag = ART_STYLE_TAGS.find(tag => 
        tag.label.includes(suggestedTags.artStyle) || 
        tag.value.toLowerCase().includes(suggestedTags.artStyle.toLowerCase())
      );
      if (matchingTag) setSelectedArtStyle(matchingTag.value);
    }
    
    if (suggestedTags.mood) {
      const matchingTag = MOOD_TAGS.find(tag => 
        tag.label.includes(suggestedTags.mood) || 
        tag.value.toLowerCase().includes(suggestedTags.mood.toLowerCase())
      );
      if (matchingTag) setSelectedMood(matchingTag.value);
    }
    
    if (suggestedTags.technical && Array.isArray(suggestedTags.technical)) {
      const matchingTags = TECHNICAL_TAGS.filter(tag =>
        suggestedTags.technical.some((tech: string) => 
          tag.value.toLowerCase().includes(tech.toLowerCase())
        )
      );
      setSelectedTechnical(matchingTags.map(tag => tag.value));
    }
    
    if (suggestedTags.enhancement && Array.isArray(suggestedTags.enhancement)) {
      const matchingTags = ENHANCEMENT_TAGS.filter(tag =>
        suggestedTags.enhancement.some((enh: string) => 
          tag.value.toLowerCase().includes(enh.toLowerCase())
        )
      );
      setSelectedEnhancements(matchingTags.map(tag => tag.value));
    }
  };

  // 改进AI标签映射函数
  const mapAITagToFrontendValue = (aiTag: string, tagGroup: any[]): string | null => {
    if (!aiTag || !tagGroup || tagGroup.length === 0) return null;
    
    const aiTagLower = aiTag.toLowerCase().trim();
    
    // 1. 精确匹配标签的 label 或 displayValue
    for (const tag of tagGroup) {
      if (tag.label.toLowerCase() === aiTagLower || 
          tag.displayValue?.toLowerCase() === aiTagLower) {
        console.log('🎯 精确匹配:', aiTag, '->', tag.value);
        return tag.value;
      }
    }
    
    // 2. 检查 AI 标签是否包含在 value 中（完全匹配）
    for (const tag of tagGroup) {
      if (tag.value.toLowerCase().includes(aiTagLower)) {
        console.log('🎯 完全包含匹配:', aiTag, '->', tag.value);
        return tag.value;
      }
    }
    
    // 3. 关键词匹配 - 检查是否有共同的关键词
    const aiKeywords = aiTagLower.split(/[,\s]+/).filter(word => word.length > 2);
    
    for (const tag of tagGroup) {
      const tagKeywords = tag.value.toLowerCase().split(/[,\s]+/).filter((word: string) => word.length > 2);
      const labelKeywords = tag.label.toLowerCase().split(/[,\s]+/).filter((word: string) => word.length > 2);
      
      // 计算关键词匹配率
      let matchCount = 0;
      for (const aiKeyword of aiKeywords) {
        if (tagKeywords.some((tagKeyword: string) => 
            tagKeyword.includes(aiKeyword) || aiKeyword.includes(tagKeyword)) ||
            labelKeywords.some((labelKeyword: string) => 
            labelKeyword.includes(aiKeyword) || aiKeyword.includes(labelKeyword))) {
          matchCount++;
        }
      }
      
      // 如果匹配率超过50%，认为是匹配的
      const matchRate = matchCount / aiKeywords.length;
      if (matchRate >= 0.5 && matchCount >= 1) {
        console.log('🎯 关键词匹配:', aiTag, '->', tag.value, `(匹配率: ${(matchRate * 100).toFixed(1)}%)`);
        return tag.value;
      }
    }
    
    // 4. 部分匹配 - 检查任何一个词的包含关系
    for (const tag of tagGroup) {
      for (const aiKeyword of aiKeywords) {
        if (aiKeyword.length > 3 && (
            tag.value.toLowerCase().includes(aiKeyword) ||
            tag.label.toLowerCase().includes(aiKeyword) ||
            tag.displayValue?.toLowerCase().includes(aiKeyword)
        )) {
          console.log('🎯 部分匹配:', aiTag, '->', tag.value, `(关键词: ${aiKeyword})`);
          return tag.value;
        }
      }
    }
    
    console.log('❌ 未找到匹配:', aiTag, '在', tagGroup.map(t => t.label));
    return null;
  };

  // 🔧 AI技术参数数组映射函数  
  const mapAITechnicalArray = (aiTechnical: string[]): string[] => {
    const mappedValues: string[] = [];
    for (const aiTag of aiTechnical) {
      const mappedValue = mapAITagToFrontendValue(aiTag, TECHNICAL_TAGS);
      if (mappedValue && !mappedValues.includes(mappedValue)) {
        mappedValues.push(mappedValue);
      }
    }
    return mappedValues;
  };

  // 🔧 AI增强参数数组映射函数
  const mapAIEnhancementArray = (aiEnhancements: string[]): string[] => {
    const mappedValues: string[] = [];
    for (const aiTag of aiEnhancements) {
      const mappedValue = mapAITagToFrontendValue(aiTag, ENHANCEMENT_TAGS);
      if (mappedValue && !mappedValues.includes(mappedValue)) {
        mappedValues.push(mappedValue);
      }
    }
    return mappedValues;
  };

  // 🔥 新增：映射AI构图参数数组
  const mapAICompositionArray = (aiComposition: string[]): string[] => {
    const mappedValues: string[] = [];
    for (const aiTag of aiComposition) {
      const mappedValue = mapAITagToFrontendValue(aiTag, COMPOSITION_TAGS);
      if (mappedValue && !mappedValues.includes(mappedValue)) {
        mappedValues.push(mappedValue);
      }
    }
    return mappedValues;
  };

  // 处理AI优化的智能应用（修复版）
  const handleAIOptimizationApply = (parsedResult: ParsedPromptResult) => {
    console.log('🎯 应用AI优化解析结果:', parsedResult);
    
    // 🎯 设置核心文本（这是必须的）
    setPrompt(parsedResult.coreText || '');
    
    // 🔥 保存完整的优化提示词，供生成时使用
    setFullOptimizedPrompt(parsedResult.fullOptimizedPrompt || null);
    console.log('🔥 保存完整优化提示词:', parsedResult.fullOptimizedPrompt);
    
    // 🔧 映射AI标签到前端完整value（改进版）
    const mappedArtStyle = parsedResult.artStyle ? mapAITagToFrontendValue(parsedResult.artStyle, ART_STYLE_TAGS) : null;
    const mappedThemeStyle = parsedResult.themeStyle ? mapAITagToFrontendValue(parsedResult.themeStyle, THEME_STYLE_TAGS) : null; // 🔥 新增
    const mappedMood = parsedResult.mood ? mapAITagToFrontendValue(parsedResult.mood, MOOD_TAGS) : null;
    const mappedTechnical = parsedResult.technical ? mapAITechnicalArray(parsedResult.technical) : [];
    const mappedComposition = parsedResult.composition ? mapAICompositionArray(parsedResult.composition) : []; // 🔥 新增
    const mappedEnhancements = parsedResult.enhancements ? mapAIEnhancementArray(parsedResult.enhancements) : [];
    
    console.log('🔧 AI标签映射结果:', {
      原始: { 
        artStyle: parsedResult.artStyle, 
        themeStyle: parsedResult.themeStyle, // 🔥 新增
        mood: parsedResult.mood, 
        technical: parsedResult.technical, 
        composition: parsedResult.composition, // 🔥 新增
        enhancements: parsedResult.enhancements 
      },
      映射: { 
        artStyle: mappedArtStyle, 
        themeStyle: mappedThemeStyle, // 🔥 新增
        mood: mappedMood, 
        technical: mappedTechnical, 
        composition: mappedComposition, // 🔥 新增
        enhancements: mappedEnhancements 
      }
    });
    
    // 🎯 检查是否有有效的映射结果
    const hasValidMappedTags = mappedArtStyle || mappedThemeStyle || mappedMood || 
                              mappedTechnical.length > 0 || mappedComposition.length > 0 || mappedEnhancements.length > 0;
    
    if (hasValidMappedTags) {
      console.log('🏷️ AI提供了有效标签，清空现有标签并应用映射后的标签');
      
      // 清空所有现有标签选择
      setSelectedArtStyle('');
      setSelectedThemeStyle('');
      setSelectedMood('');
      setSelectedTechnical([]);
      setSelectedComposition([]);
      setSelectedEnhancements([]);
      setIsQualityEnhanced(false);
      
      // 设置映射后的标签
      if (mappedArtStyle) {
        setSelectedArtStyle(mappedArtStyle);
        console.log('🎨 设置艺术风格:', mappedArtStyle);
      }
      
      if (mappedThemeStyle) { // 🔥 新增主题风格映射
        setSelectedThemeStyle(mappedThemeStyle);
        console.log('🏛️ 设置主题风格:', mappedThemeStyle);
      }
      
      if (mappedMood) {
        setSelectedMood(mappedMood);
        console.log('😊 设置情绪氛围:', mappedMood);
      }
      
      if (mappedTechnical.length > 0) {
        setSelectedTechnical(mappedTechnical);
        console.log('📷 设置技术参数:', mappedTechnical);
      }
      
      if (mappedComposition.length > 0) { // 🔥 新增构图参数映射
        setSelectedComposition(mappedComposition);
        console.log('🖼️ 设置构图参数:', mappedComposition);
      }
      
      if (mappedEnhancements.length > 0) {
        setSelectedEnhancements(mappedEnhancements);
        console.log('✨ 设置效果增强:', mappedEnhancements);
      }
      
      if (parsedResult.qualityEnhanced) {
        setIsQualityEnhanced(true);
        console.log('🚀 启用质量增强');
      }
    } else {
      console.log('⚠️ AI标签映射失败或无有效标签，保留现有标签选择');
    }
    
    // 🔥 强制重新渲染标签显示，确保UI同步
    setTimeout(() => {
      console.log('🔄 强制重新渲染后的标签状态:', {
        artStyle: selectedArtStyle,
        themeStyle: selectedThemeStyle,
        mood: selectedMood,
        technical: selectedTechnical,
        composition: selectedComposition,
        enhancements: selectedEnhancements,
        qualityEnhanced: isQualityEnhanced
      });
    }, 100);
    
    // 调整文本框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  // 开始生成
  const handleGenerate = async () => {
    // 🔥 优先使用完整的优化提示词，如果没有则使用组合后的提示词
    const effectivePrompt = fullOptimizedPrompt || getFullPrompt();
    console.log('🎯 PromptInput开始生成');
    console.log('🔥 使用提示词:', effectivePrompt);
    console.log('🔥 是否使用优化提示词:', fullOptimizedPrompt ? '是' : '否');

    if (!effectivePrompt.trim() || disabled) return;

    // 🔥 前置用量检查
    if (appUser) {
      const remainingQuota = appUser.daily_quota - appUser.used_today;
      if (remainingQuota <= 0) {
        alert('今日生成次数已用完，明日凌晨自动重置！');
        return;
      }
    }

    // 收集所有选择的标签信息
    const selectedTags = {
      artStyle: selectedArtStyle || undefined,
      themeStyle: selectedThemeStyle || undefined,
      mood: selectedMood || undefined,
      technical: selectedTechnical.length > 0 ? selectedTechnical : undefined,
      composition: selectedComposition.length > 0 ? selectedComposition : undefined,
      enhancement: selectedEnhancements.length > 0 ? selectedEnhancements : undefined,
      // negative: 已移除 - 负面提示词功能已删除
      isQualityEnhanced: isQualityEnhanced || undefined,
    };

    // 🔥 详细调试信息
    console.log('📊 详细的标签收集状态:');
    console.log('🎨 艺术风格 (selectedArtStyle):', selectedArtStyle);
    console.log('🏛️ 主题风格 (selectedThemeStyle):', selectedThemeStyle);
    console.log('😊 情绪氛围 (selectedMood):', selectedMood);
    console.log('📷 技术参数 (selectedTechnical):', selectedTechnical);
    console.log('🖼️ 构图参数 (selectedComposition):', selectedComposition);
    console.log('✨ 增强效果 (selectedEnhancements):', selectedEnhancements);
    // console.log('负面提示词', 已移除);
    console.log('💎 品质增强 (isQualityEnhanced):', isQualityEnhanced);
    console.log('🎯 最终selectedTags对象:', selectedTags);

    const config: GenerationConfig = {
      ...currentConfig,
      prompt: effectivePrompt.trim(), // 🔥 使用有效提示词（优化提示词或组合提示词）
      // negativePrompt: 已移除 - 负面提示词功能已删除
      selectedTags, // 新增：传递标签信息
    } as GenerationConfig;

    console.log('🔥 最终生成配置 (config):', config);

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
      onGenerate(config);
    } else {
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
                         selectedEnhancements.length > 0 || selectedTechnical.length > 0 ||
                         selectedComposition.length > 0 || // negative 已移除 || 
                         isQualityEnhanced;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* AI提示词状态指示器 */}
      {fullOptimizedPrompt && (
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-purple-700">✨ 使用AI优化提示词</span>
          </div>
          <button
            onClick={() => setFullOptimizedPrompt(null)}
            className="px-3 py-1 text-xs bg-white hover:bg-gray-50 text-gray-600 rounded-lg transition-colors border border-gray-300"
          >
            切换回原始
          </button>
        </div>
      )}

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
          onClick={() => setShowTemplates(!showTemplates)}
          className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors"
        >
          📸 场景模板
        </button>
        
        {/* 负面提示词按钮已移除 - 功能已删除 */}
        
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
          onClick={handleAIAssistantToggle}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm border-2 ${
            showAIAssistant
              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-purple-400 shadow-lg scale-105'
              : 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 hover:from-purple-200 hover:to-blue-200 border-purple-300 hover:shadow-md hover:scale-102'
          }`}
        >
          <span className="flex items-center gap-1">
            🤖 {showAIAssistant ? '隐藏AI助手' : 'AI智能助手'}
            {!showAIAssistant && <span className="text-xs bg-purple-200 text-purple-800 px-1 rounded">NEW</span>}
          </span>
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
        
        {/* 🌐 翻译提示词按钮 */}
        {fullOptimizedPrompt && (
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            {showTranslation ? '🌐 隐藏翻译' : '🌐 翻译提示词'}
          </button>
        )}
      </div>

      {/* 🌐 翻译结果显示 */}
      {showTranslation && fullOptimizedPrompt && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-700 font-medium">🌐 中文翻译</div>
            <button
              onClick={handleTranslation}
              disabled={isTranslating}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              {isTranslating ? '翻译中...' : translation ? '重新翻译' : '获取翻译'}
            </button>
          </div>
          
          {translation ? (
            <div className="bg-white p-3 rounded border">
              <p className="text-sm text-gray-700 leading-relaxed">
                {translation.chineseTranslation}
              </p>
              {translation.explanation && (
                <p className="text-xs text-blue-600 mt-2">
                  💡 {translation.explanation}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <div className="text-sm">点击"获取翻译"查看英文提示词的中文含义</div>
            </div>
          )}
        </div>
      )}

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
                <span className="text-gray-600">{getDisplayValue(selectedArtStyle, [ART_STYLE_TAGS])}</span>
              </div>
            )}
            {selectedThemeStyle && (
              <div className="text-xs">
                <span className="text-purple-600 font-medium">🏛️ 主题风格：</span>
                <span className="text-gray-600">{getDisplayValue(selectedThemeStyle, [THEME_STYLE_TAGS])}</span>
              </div>
            )}
            {selectedMood && (
              <div className="text-xs">
                <span className="text-orange-600 font-medium">😊 情绪氛围：</span>
                <span className="text-gray-600">{getDisplayValue(selectedMood, [MOOD_TAGS])}</span>
              </div>
            )}
            {selectedTechnical.length > 0 && (
              <div className="text-xs">
                <span className="text-blue-600 font-medium">📷 技术参数：</span>
                <span className="text-gray-600">{selectedTechnical.map(val => getDisplayValue(val, [TECHNICAL_TAGS])).join('，')}</span>
              </div>
            )}
            {selectedComposition.length > 0 && (
              <div className="text-xs">
                <span className="text-teal-600 font-medium">🖼️ 构图参数：</span>
                <span className="text-gray-600">{selectedComposition.map(val => getDisplayValue(val, [COMPOSITION_TAGS])).join('，')}</span>
              </div>
            )}
            {selectedEnhancements.length > 0 && (
              <div className="text-xs">
                <span className="text-indigo-600 font-medium">✨ 效果增强：</span>
                <span className="text-gray-600">{selectedEnhancements.map(val => getDisplayValue(val, [ENHANCEMENT_TAGS])).join('，')}</span>
              </div>
            )}
            {isQualityEnhanced && (
              <div className="text-xs">
                <span className="text-green-600 font-medium">🔥 品质增强：</span>
                <span className="text-gray-600">高品质细节增强</span>
              </div>
            )}
            {/* 负面提示词已移除 - 现代AI模型不需要负面提示词 */}
          </div>
        </div>
      )}

      {/* 主题建议面板 */}
      {showSuggestions && (
        <SubjectSuggestionsPanel
          suggestions={SUBJECT_SUGGESTIONS}
          onSelect={addSubjectSuggestion}
        />
      )}

      {/* 场景模板浏览器 */}
      {showTemplates && (
        <SceneTemplateBrowser
          onSelectTemplate={applySceneTemplate}
          selectedTemplateId={selectedTemplate}
        />
      )}

      {/* 标签选择器组 */}
      <TagSelectorGroup
        title="艺术风格"
        icon="🎨"
        tags={ART_STYLE_TAGS}
        selectedValue={selectedArtStyle}
        onSelect={selectArtStyle}
        compact={compact}
        colorScheme="blue"
      />

      <TagSelectorGroup
        title="主题风格"
        icon="🏛️"
        tags={THEME_STYLE_TAGS}
        selectedValue={selectedThemeStyle}
        onSelect={selectThemeStyle}
        compact={compact}
        colorScheme="purple"
      />

      <TagSelectorGroup
        title="情绪氛围"
        icon="😊"
        tags={MOOD_TAGS}
        selectedValue={selectedMood}
        onSelect={selectMood}
        compact={compact}
        colorScheme="orange"
      />

      <TagSelectorGroup
        title="效果增强"
        icon="✨"
        tags={ENHANCEMENT_TAGS}
        selectedValue={selectedEnhancements}
        onSelect={toggleEnhancement}
        isMultiple
        compact={compact}
        colorScheme="indigo"
      />

      <TagSelectorGroup
        title="技术参数"
        icon="📷"
        tags={TECHNICAL_TAGS}
        selectedValue={selectedTechnical}
        onSelect={toggleTechnical}
        isMultiple
        compact={compact}
        colorScheme="blue"
      />

      <TagSelectorGroup
        title="构图参数"
        icon="🖼️"
        tags={COMPOSITION_TAGS}
        selectedValue={selectedComposition}
        onSelect={toggleComposition}
        isMultiple
        compact={compact}
        colorScheme="teal"
      />

      {/* 高级选项组已移除 - 负面提示词功能已删除，现代AI模型不需要负面提示词 */}

      {/* AI智能助手 */}
      {showAIAssistant && (
        <PromptAssistant
          prompt={getFullPrompt()}
          onPromptChange={setPrompt}
          selectedModel={currentConfig?.model || 'flux-schnell'}
          onTagsChange={handleAITagSuggestions}
          onApplyOptimization={handleAIOptimizationApply}
          onAIStateChange={setAiState}
          onAnalysisComplete={(hasResult) => {
            setHasAnalysisResult(hasResult);
            setTriggerAnalysis(false);
          }}
          triggerAnalysis={triggerAnalysis}
          className="mt-6"
        />
      )}

      {/* 配额状态显示 */}
      {appUser && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                (appUser.daily_quota - appUser.used_today) > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium text-gray-700">今日配额</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold ${
                (appUser.daily_quota - appUser.used_today) > 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {appUser.daily_quota - appUser.used_today}
              </span>
              <span className="text-gray-500 text-sm"> / {appUser.daily_quota}</span>
            </div>
          </div>
          {(appUser.daily_quota - appUser.used_today) <= 0 && (
            <div className="mt-2 text-xs text-red-600">
              ⚠️ 今日配额已用完，明日凌晨自动重置
            </div>
          )}
        </div>
      )}

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={
          !fullPrompt.trim() ||
          disabled ||
          aiState.isAnalyzing ||
          aiState.isOptimizing ||
          !!(appUser && (appUser.daily_quota - appUser.used_today) <= 0)
        }
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
      >
        {aiState.isAnalyzing ? (
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            AI分析中...
          </div>
        ) : aiState.isOptimizing ? (
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            AI优化中...
          </div>
        ) : (appUser && (appUser.daily_quota - appUser.used_today) <= 0) ? (
          '配额已用完'
        ) : (
          '😊 开始生成'
        )}
      </button>

      <div className="text-center text-xs text-gray-500">
        提示：使用 Ctrl+Enter (Mac: Cmd+Enter) 快速生成
      </div>
    </div>
  );
} 