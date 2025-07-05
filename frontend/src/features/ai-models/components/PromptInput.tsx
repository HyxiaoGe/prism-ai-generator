import React, { useState, useRef, useEffect } from 'react';
import { useAIGenerationStore } from '../../../store/aiGenerationStore';
import { AIService } from '../services/aiService';
import type { GenerationConfig } from '../../../types';

interface PromptInputProps {
  onGenerate?: (config: GenerationConfig) => void;
  disabled?: boolean;
  initialPrompt?: string;
  compact?: boolean;
  suggestedTags?: any;
  parsedFeatures?: any; // 新增：解析出的特征信息，用于自动选择标签
}

// 艺术风格组（单选 - 避免风格冲突）- 扩充版
const ART_STYLE_TAGS = [
  { label: '摄影级逼真', value: 'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed', displayValue: '摄影级逼真效果' },
  { label: '电影级画质', value: 'cinematic photography, film photography, dramatic lighting, cinematic composition', displayValue: '电影级摄影画质' },
  { label: '油画风格', value: 'oil painting, classical art, brush strokes, Renaissance style', displayValue: '经典油画风格' },
  { label: '水彩画', value: 'watercolor painting, soft brushes, artistic, flowing colors', displayValue: '柔美水彩画风' },
  { label: '动漫风格', value: 'anime style, manga, japanese animation, cel shading', displayValue: '日式动漫风格' },
  { label: '像素艺术', value: 'pixel art, 8-bit, retro gaming style, pixelated', displayValue: '复古像素艺术' },
  { label: '素描风格', value: 'pencil sketch, black and white, hand drawn, charcoal drawing', displayValue: '手绘素描风格' },
  { label: '概念艺术', value: 'concept art, digital painting, matte painting, professional illustration', displayValue: '游戏概念艺术' },
  { label: '3D渲染', value: '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering', displayValue: '3D渲染技术' },
  { label: '印象派', value: 'impressionist style, soft focus, painterly, artistic brushwork', displayValue: '印象派艺术风格' },
];

// 主题风格组（单选 - 避免主题冲突）- 扩充版
const THEME_STYLE_TAGS = [
  { label: '赛博朋克', value: 'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets', displayValue: '赛博朋克未来都市' },
  { label: '科幻场景', value: 'sci-fi, futuristic, space technology, holographic displays, advanced technology', displayValue: '科幻未来场景' },
  { label: '奇幻风格', value: 'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere', displayValue: '奇幻魔法世界' },
  { label: '蒸汽朋克', value: 'steampunk, vintage machinery, brass gears, Victorian era, industrial', displayValue: '蒸汽朋克机械风' },
  { label: '中国风', value: 'chinese style, traditional, elegant, ink wash painting, oriental aesthetics', displayValue: '中国传统古风' },
  { label: '现代简约', value: 'modern, minimalist, clean design, sleek, contemporary', displayValue: '现代简约设计' },
  { label: '复古未来', value: 'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave', displayValue: '复古未来主义' },
  { label: '自然生态', value: 'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable', displayValue: '自然生态风格' },
  { label: '工业风格', value: 'industrial design, metallic textures, concrete, raw materials, urban decay', displayValue: '工业废土风格' },
  { label: '哥特风格', value: 'gothic architecture, dark romantic, ornate details, mysterious atmosphere', displayValue: '哥特神秘风格' },
];

// 情绪氛围组（单选 - 避免情绪冲突）- 扩充版
const MOOD_TAGS = [
  { label: '温暖明亮', value: 'warm lighting, bright, cheerful, golden hour, soft sunlight', displayValue: '温暖明亮氛围' },
  { label: '神秘暗黑', value: 'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro', displayValue: '神秘暗黑氛围' },
  { label: '梦幻唯美', value: 'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like', displayValue: '梦幻唯美氛围' },
  { label: '震撼史诗', value: 'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring', displayValue: '震撼史诗氛围' },
  { label: '宁静平和', value: 'peaceful, calm, serene, tranquil, meditation, zen atmosphere', displayValue: '宁静禅意氛围' },
  { label: '活力动感', value: 'energetic, dynamic, vibrant, lively, high-energy, action-packed', displayValue: '活力动感氛围' },
  { label: '忧郁沉思', value: 'melancholic, contemplative, nostalgic, bittersweet, introspective', displayValue: '忧郁沉思氛围' },
  { label: '奢华高贵', value: 'luxurious, elegant, sophisticated, premium, high-end, glamorous', displayValue: '奢华高贵氛围' },
  { label: '原始野性', value: 'wild, primal, untamed, rugged, natural, raw power', displayValue: '原始野性氛围' },
  { label: '未来科技', value: 'futuristic, high-tech, digital, cyber, holographic, technological', displayValue: '未来科技氛围' },
];

// 技术参数组（新增 - 可多选）
const TECHNICAL_TAGS = [
  { label: '85mm镜头', value: '85mm lens, portrait lens, shallow depth of field', displayValue: '85mm人像镜头' },
  { label: '广角镜头', value: 'wide-angle lens, 24mm, expansive view, environmental context', displayValue: '24mm广角镜头' },
  { label: '微距摄影', value: 'macro photography, extreme close-up, intricate details, magnified', displayValue: '微距特写摄影' },
  { label: '长焦镜头', value: 'telephoto lens, 200mm, compressed perspective, background blur', displayValue: '200mm长焦镜头' },
  { label: '鱼眼效果', value: 'fisheye lens, distorted perspective, 180-degree view, curved edges', displayValue: '鱼眼广角效果' },
  { label: '景深控制', value: 'shallow depth of field, f/1.4, bokeh effect, selective focus', displayValue: '浅景深虚化' },
  { label: '全景深', value: 'deep focus, f/11, everything in focus, landscape photography', displayValue: '全景深清晰' },
  { label: '黄金时刻', value: 'golden hour lighting, warm sunlight, magic hour, soft shadows', displayValue: '黄金时刻光线' },
  { label: '蓝调时刻', value: 'blue hour, twilight, evening atmosphere, city lights', displayValue: '蓝调时刻光线' },
  { label: '工作室灯光', value: 'studio lighting, softbox, professional lighting setup, controlled environment', displayValue: '专业工作室灯光' },
];

// 构图参数组（新增 - 可多选）  
const COMPOSITION_TAGS = [
  { label: '三分法则', value: 'rule of thirds, balanced composition, dynamic framing', displayValue: '三分法则构图' },
  { label: '中心构图', value: 'centered composition, symmetrical, balanced, focal point', displayValue: '中心对称构图' },
  { label: '低角度仰拍', value: 'low angle shot, worm eye view, heroic perspective, dramatic angle', displayValue: '低角度仰拍视角' },
  { label: '高角度俯拍', value: 'high angle shot, bird eye view, overhead perspective, aerial view', displayValue: '高角度俯拍视角' },
  { label: '特写镜头', value: 'close-up shot, intimate framing, detailed focus, emotional connection', displayValue: '特写镜头构图' },
  { label: '全景镜头', value: 'wide shot, establishing shot, environmental context, full scene', displayValue: '全景镜头构图' },
  { label: '肩部特写', value: 'medium shot, upper body, conversational framing, portrait style', displayValue: '肩部特写构图' },
  { label: '极近特写', value: 'extreme close-up, macro detail, textural focus, intimate detail', displayValue: '极近特写构图' },
  { label: '动态构图', value: 'dynamic composition, diagonal lines, movement, energy', displayValue: '动态运动构图' },
  { label: '极简构图', value: 'minimalist composition, negative space, clean lines, simple elegance', displayValue: '极简留白构图' },
];

// 补充标签组（可多选 - 不冲突的增强属性）- 扩充版
const ENHANCEMENT_TAGS = [
  { label: '超高细节', value: 'highly detailed, intricate details, ultra-detailed textures, photorealistic details', displayValue: '超高细节刻画' },
  { label: '电影感', value: 'cinematic composition, film photography, movie-like quality, Hollywood style', displayValue: '电影质感效果' },
  { label: '专业摄影', value: 'professional photography, studio quality, commercial grade, award-winning', displayValue: '专业摄影品质' },
  { label: '艺术大师', value: 'masterpiece, award winning, gallery quality, museum piece', displayValue: '艺术大师作品' },
  { label: '体积光效', value: 'volumetric lighting, god rays, atmospheric lighting, light beams', displayValue: '体积光线效果' },
  { label: '色彩分级', value: 'color grading, cinematic colors, film look, professional color correction', displayValue: '电影级色彩调色' },
  { label: 'HDR效果', value: 'HDR photography, high dynamic range, enhanced contrast, vivid colors', displayValue: 'HDR高动态范围' },
  { label: '胶片质感', value: 'film grain, analog photography, vintage film look, organic texture', displayValue: '胶片质感效果' },
];

// 负面提示词组（新增）
const NEGATIVE_PROMPT_TAGS = [
  { label: '避免模糊', value: 'blurry, out of focus, motion blur, soft focus', displayValue: '避免画面模糊' },
  { label: '避免低质量', value: 'low quality, pixelated, compressed, artifact, noise', displayValue: '避免低质量画面' },
  { label: '避免变形', value: 'distorted, deformed, mutated, disfigured, anatomical errors', displayValue: '避免形体变形' },
  { label: '避免过曝', value: 'overexposed, blown out highlights, washed out, too bright', displayValue: '避免过度曝光' },
  { label: '避免卡通化', value: 'cartoonish, anime, illustration, drawing, painted', displayValue: '避免卡通化效果' },
  { label: '避免复制粘贴感', value: 'copy paste, repetitive, tiled, pattern artifacts', displayValue: '避免重复瑕疵' },
];

// 场景预设模板（新增）
const SCENE_TEMPLATES = [
  { 
    label: '人像摄影', 
    prompt: '专业人像摄影',
    technical: '85mm lens, shallow depth of field, f/1.8',
    lighting: 'soft studio lighting, professional portrait setup',
    mood: 'confident, professional atmosphere'
  },
  {
    label: '风景摄影',
    prompt: '壮丽自然风景',
    technical: 'wide-angle lens, deep focus, f/11',
    lighting: 'golden hour lighting, dramatic sky',
    mood: 'majestic, awe-inspiring atmosphere'
  },
  {
    label: '产品摄影',
    prompt: '高端产品展示',
    technical: 'macro lens, perfect focus, commercial quality',
    lighting: 'studio lighting, gradient shadows, clean background',
    mood: 'premium, elegant, minimalist'
  },
  {
    label: '街头摄影',
    prompt: '真实街头场景',
    technical: '35mm lens, documentary style, candid moment',
    lighting: 'natural lighting, urban environment',
    mood: 'authentic, gritty, urban life'
  },
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

// 辅助函数：根据value查找对应的中文displayValue
const getDisplayValue = (value: string, tagGroups: any[]): string => {
  for (const group of tagGroups) {
    const tag = group.find((tag: any) => tag.value === value);
    if (tag) return tag.displayValue || tag.label;
  }
  return value; // 如果找不到，返回原值
};

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
  const [selectedNegative, setSelectedNegative] = useState<string[]>([]); // 负面提示词
  
  const [isQualityEnhanced, setIsQualityEnhanced] = useState(false); // 品质增强独立存储
  const [showFullPrompt, setShowFullPrompt] = useState(false); // 是否显示完整提示词预览
  const [showAdvanced, setShowAdvanced] = useState(false); // 是否显示高级选项
  const [showTemplates, setShowTemplates] = useState(false); // 是否显示场景模板
  const [selectedTemplate, setSelectedTemplate] = useState(''); // 选中的场景模板
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
    setSelectedTechnical([]);
    setSelectedComposition([]);
    setSelectedNegative([]);
    setIsQualityEnhanced(false);
    setSelectedTemplate('');
  }, [initialPrompt]);

  // 🎯 智能标签解析 - 根据parsedFeatures自动选择对应的标签
  useEffect(() => {
    if (!parsedFeatures) return;
    
    console.log('🏷️ 开始智能标签设置:', parsedFeatures);
    
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
        console.log('🎨 设置艺术风格:', parsedFeatures.artStyle.label, '→', artStyleValue);
      }
    }
    
    // 设置主题风格（单选）
    if (parsedFeatures.themeStyle) {
      const themeStyleValue = findTagValueByLabel(parsedFeatures.themeStyle.label, [THEME_STYLE_TAGS]);
      if (themeStyleValue) {
        setSelectedThemeStyle(themeStyleValue);
        console.log('🏗️ 设置主题风格:', parsedFeatures.themeStyle.label, '→', themeStyleValue);
      }
    }
    
    // 设置情绪氛围（单选）
    if (parsedFeatures.mood) {
      const moodValue = findTagValueByLabel(parsedFeatures.mood.label, [MOOD_TAGS]);
      if (moodValue) {
        setSelectedMood(moodValue);
        console.log('😊 设置情绪氛围:', parsedFeatures.mood.label, '→', moodValue);
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
        console.log('✨ 设置增强效果:', enhancementValues);
      }
      
      if (technicalValues.length > 0) {
        setSelectedTechnical(technicalValues);
        console.log('📷 设置技术参数:', technicalValues);
      }
      
      if (compositionValues.length > 0) {
        setSelectedComposition(compositionValues);
        console.log('📐 设置构图参数:', compositionValues);
      }
    }
    
    // 设置品质增强
    if (parsedFeatures.qualityEnhanced) {
      setIsQualityEnhanced(true);
      console.log('💎 设置品质增强: true');
    }
    
    console.log('✅ 智能标签设置完成');
    
  }, [parsedFeatures]);

  // 当suggestedTags变化时应用推荐标签
  useEffect(() => {
    if (suggestedTags) {
      console.log('🎯 应用推荐标签:', suggestedTags);
      
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
      
      // 自动开启高级选项
      if (suggestedTags.technical?.length > 0 || suggestedTags.composition?.length > 0) {
        setShowAdvanced(true);
      }
      
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

  // 生成负面提示词
  const getNegativePrompt = (): string => {
    if (selectedNegative.length === 0) return '';
    return selectedNegative.join(', ');
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

  // 切换负面提示词（多选）
  const toggleNegative = (tagValue: string) => {
    setSelectedNegative(prev => 
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

  // 应用场景模板
  const applySceneTemplate = (template: typeof SCENE_TEMPLATES[0]) => {
    setPrompt(template.prompt);
    setSelectedTemplate(template.label);
    setShowTemplates(false);
    
    // 解析模板的技术参数
    if (template.technical) {
      // 这里可以智能匹配模板参数到对应的标签
      const technicalMatches = TECHNICAL_TAGS.filter(tag => 
        template.technical.toLowerCase().includes(tag.label.slice(0, 3).toLowerCase())
      );
      setSelectedTechnical(technicalMatches.map(tag => tag.value));
    }
    
    // 解析模板的情绪参数
    if (template.mood) {
      const moodMatch = MOOD_TAGS.find(tag => 
        template.mood.toLowerCase().includes(tag.label.slice(0, 3).toLowerCase())
      );
      if (moodMatch) {
        setSelectedMood(moodMatch.value);
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
    setSelectedNegative([]);
    setIsQualityEnhanced(false);
    setSelectedTemplate('');
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
                         selectedEnhancements.length > 0 || selectedTechnical.length > 0 ||
                         selectedComposition.length > 0 || selectedNegative.length > 0 || 
                         isQualityEnhanced;

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
          onClick={() => setShowTemplates(!showTemplates)}
          className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition-colors"
        >
          📸 场景模板
        </button>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            showAdvanced
              ? 'bg-indigo-500 text-white'
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
          }`}
        >
          {showAdvanced ? '⚙️ 隐藏高级' : '⚙️ 高级选项'}
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
                <span className="text-gray-600">{getDisplayValue(selectedArtStyle, [ART_STYLE_TAGS])}</span>
              </div>
            )}
            {selectedThemeStyle && (
              <div className="text-xs">
                <span className="text-purple-600 font-medium">🌟 主题风格：</span>
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
            {selectedNegative.length > 0 && (
              <div className="text-xs">
                <span className="text-red-600 font-medium">🚫 负面提示词：</span>
                <span className="text-gray-600">{selectedNegative.map(val => getDisplayValue(val, [NEGATIVE_PROMPT_TAGS])).join('，')}</span>
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

      {/* 场景模板面板 */}
      {showTemplates && (
        <div className="p-4 bg-violet-50/70 backdrop-blur-sm rounded-xl border border-violet-200">
          <h4 className="font-medium text-gray-800 mb-3">📸 专业场景模板</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCENE_TEMPLATES.map((template, index) => (
              <div
                key={index}
                onClick={() => applySceneTemplate(template)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  selectedTemplate === template.label
                    ? 'border-violet-500 bg-violet-100'
                    : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                <div className="font-medium text-gray-800 mb-1">{template.label}</div>
                <div className="text-xs text-gray-600 mb-2">{template.prompt}</div>
                <div className="text-xs text-violet-600">
                  {template.technical} • {template.lighting}
                </div>
              </div>
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

      {/* 高级选项组 */}
      {showAdvanced && (
        <div className="space-y-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-200">
          <div className="text-sm font-medium text-indigo-800 mb-4">⚙️ 高级选项</div>
          
          {/* 技术参数组（可多选） */}
          <div className={compact ? "space-y-2" : "space-y-3"}>
            <div className="flex items-center justify-between">
              <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>📷 技术参数 <span className="text-xs text-gray-500">(可多选)</span></h4>
              {selectedTechnical.length > 0 && (
                <span className="text-xs text-blue-600">已选择 {selectedTechnical.length} 个</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TECHNICAL_TAGS.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => toggleTechnical(tag.value)}
                  className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                    selectedTechnical.includes(tag.value)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* 构图参数组（可多选） */}
          <div className={compact ? "space-y-2" : "space-y-3"}>
            <div className="flex items-center justify-between">
              <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>🖼️ 构图参数 <span className="text-xs text-gray-500">(可多选)</span></h4>
              {selectedComposition.length > 0 && (
                <span className="text-xs text-teal-600">已选择 {selectedComposition.length} 个</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPOSITION_TAGS.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => toggleComposition(tag.value)}
                  className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                    selectedComposition.includes(tag.value)
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* 负面提示词组（可多选） */}
          <div className={compact ? "space-y-2" : "space-y-3"}>
            <div className="flex items-center justify-between">
              <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>🚫 负面提示词 <span className="text-xs text-gray-500">(避免的元素)</span></h4>
              {selectedNegative.length > 0 && (
                <span className="text-xs text-red-600">已选择 {selectedNegative.length} 个</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {NEGATIVE_PROMPT_TAGS.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => toggleNegative(tag.value)}
                  className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
                    selectedNegative.includes(tag.value)
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* 负面提示词预览 */}
          {selectedNegative.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-700 font-medium mb-1">负面提示词：</div>
              <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                {getNegativePrompt()}
              </div>
            </div>
          )}
        </div>
      )}

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