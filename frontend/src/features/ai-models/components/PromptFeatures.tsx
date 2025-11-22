import React, { useState } from 'react';
import { GenerationResult } from '../../../types';

// AI模型信息 - 与数据库模型ID匹配
const getModelInfo = (model: string) => {
  const modelMap: Record<string, { label: string; icon: string; color: string }> = {
    'flux-schnell': { label: 'Flux Schnell', icon: '⚡', color: 'blue' },
    'imagen-4-ultra': { label: 'Imagen 4 Ultra', icon: '🚀', color: 'green' },
    'nano-banana': { label: 'Nano Banana', icon: '🍌', color: 'yellow' },
  };
  return modelMap[model] || { label: '未知模型', icon: '🤖', color: 'gray' };
};

// 颜色类映射
const getColorClasses = (color: string) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    violet: 'bg-violet-100 text-violet-800 border-violet-200',
  };
  return colorMap[color] || colorMap.gray;
};

// 标签值到显示信息的映射
const getTagDisplayInfo = (value: string, type: string): { label: string; icon: string; color: string } => {
  const tagMap: Record<string, { label: string; icon: string; color: string }> = {
    // 艺术风格映射
    'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed': { label: '摄影级逼真效果', icon: '📸', color: 'blue' },
    'cinematic photography, film photography, dramatic lighting, cinematic composition': { label: '电影级摄影画质', icon: '🎬', color: 'purple' },
    'oil painting, classical art, brush strokes, Renaissance style': { label: '经典油画风格', icon: '🎨', color: 'orange' },
    'watercolor painting, soft brushes, artistic, flowing colors': { label: '柔美水彩画风', icon: '🌈', color: 'cyan' },
    'anime style, manga, japanese animation, cel shading': { label: '日式动漫风格', icon: '🗾', color: 'pink' },
    'pixel art, 8-bit, retro gaming style, pixelated': { label: '复古像素艺术', icon: '🎮', color: 'purple' },
    'pencil sketch, black and white, hand drawn, charcoal drawing': { label: '手绘素描风格', icon: '✏️', color: 'gray' },
    'concept art, digital painting, matte painting, professional illustration': { label: '游戏概念艺术', icon: '🎯', color: 'indigo' },
    '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering': { label: '3D渲染技术', icon: '🏗️', color: 'slate' },
    'impressionist style, soft focus, painterly, artistic brushwork': { label: '印象派艺术风格', icon: '🌅', color: 'amber' },
    
    // 主题风格映射
    'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets': { label: '赛博朋克未来都市', icon: '🌃', color: 'purple' },
    'sci-fi, futuristic, space technology, holographic displays, advanced technology': { label: '科幻未来场景', icon: '🚀', color: 'blue' },
    'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere': { label: '奇幻魔法世界', icon: '🧙‍♂️', color: 'indigo' },
    'steampunk, vintage machinery, brass gears, Victorian era, industrial': { label: '蒸汽朋克机械风', icon: '⚙️', color: 'amber' },
    'chinese style, traditional, elegant, ink wash painting, oriental aesthetics': { label: '中国传统古风', icon: '🏮', color: 'red' },
    'modern, minimalist, clean design, sleek, contemporary': { label: '现代简约设计', icon: '🏢', color: 'slate' },
    'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave': { label: '复古未来主义', icon: '🌐', color: 'violet' },
    'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable': { label: '自然生态风格', icon: '🌿', color: 'green' },
    'industrial design, metallic textures, concrete, raw materials, urban decay': { label: '工业废土风格', icon: '🏭', color: 'gray' },
    'gothic architecture, dark romantic, ornate details, mysterious atmosphere': { label: '哥特神秘风格', icon: '🏰', color: 'slate' },
    
    // 情绪氛围映射
    'warm lighting, bright, cheerful, golden hour, soft sunlight': { label: '温暖明亮氛围', icon: '☀️', color: 'yellow' },
    'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro': { label: '神秘暗黑氛围', icon: '🌙', color: 'slate' },
    'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like': { label: '梦幻唯美氛围', icon: '✨', color: 'violet' },
    'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring': { label: '震撼史诗氛围', icon: '⚡', color: 'orange' },
    'peaceful, calm, serene, tranquil, meditation, zen atmosphere': { label: '宁静禅意氛围', icon: '🕊️', color: 'green' },
    'energetic, dynamic, vibrant, lively, high-energy, action-packed': { label: '活力动感氛围', icon: '🔥', color: 'red' },
    'melancholic, contemplative, nostalgic, bittersweet, introspective': { label: '忧郁沉思氛围', icon: '🌧️', color: 'blue' },
    'luxurious, elegant, sophisticated, premium, high-end, glamorous': { label: '奢华高贵氛围', icon: '💎', color: 'amber' },
    'wild, primal, untamed, rugged, natural, raw power': { label: '原始野性氛围', icon: '🦁', color: 'orange' },
    'futuristic, high-tech, digital, cyber, holographic, technological': { label: '未来科技氛围', icon: '🤖', color: 'cyan' },
    
    // 技术参数映射
    '85mm lens, portrait lens, shallow depth of field': { label: '85mm人像镜头', icon: '📷', color: 'blue' },
    'wide-angle lens, 24mm, expansive view, environmental context': { label: '24mm广角镜头', icon: '📐', color: 'blue' },
    'macro photography, extreme close-up, intricate details, magnified': { label: '微距特写摄影', icon: '🔍', color: 'green' },
    'telephoto lens, 200mm, compressed perspective, background blur': { label: '200mm长焦镜头', icon: '🎯', color: 'purple' },
    'fisheye lens, distorted perspective, 180-degree view, curved edges': { label: '鱼眼广角效果', icon: '🌐', color: 'cyan' },
    'shallow depth of field, f/1.4, bokeh effect, selective focus': { label: '浅景深虚化', icon: '✨', color: 'violet' },
    'deep focus, f/11, everything in focus, landscape photography': { label: '全景深清晰', icon: '🏔️', color: 'green' },
    'golden hour lighting, warm sunlight, magic hour, soft shadows': { label: '黄金时刻光线', icon: '🌅', color: 'yellow' },
    'blue hour, twilight, evening atmosphere, city lights': { label: '蓝调时刻光线', icon: '🌆', color: 'blue' },
    'studio lighting, softbox, professional lighting setup, controlled environment': { label: '专业工作室灯光', icon: '💡', color: 'amber' },
    
    // 构图参数映射
    'rule of thirds, balanced composition, dynamic framing': { label: '三分法则构图', icon: '📐', color: 'indigo' },
    'centered composition, symmetrical, balanced, focal point': { label: '中心对称构图', icon: '🎯', color: 'indigo' },
    'low angle shot, worm eye view, heroic perspective, dramatic angle': { label: '低角度仰拍视角', icon: '📈', color: 'orange' },
    'high angle shot, bird eye view, overhead perspective, aerial view': { label: '高角度俯拍视角', icon: '📉', color: 'cyan' },
    'close-up shot, intimate framing, detailed focus, emotional connection': { label: '特写镜头构图', icon: '🔍', color: 'pink' },
    'wide shot, establishing shot, environmental context, full scene': { label: '全景镜头构图', icon: '🌄', color: 'green' },
    'medium shot, upper body, conversational framing, portrait style': { label: '肩部特写构图', icon: '👤', color: 'gray' },
    'extreme close-up, macro detail, textural focus, intimate detail': { label: '极近特写构图', icon: '👁️', color: 'violet' },
    'dynamic composition, diagonal lines, movement, energy': { label: '动态运动构图', icon: '⚡', color: 'red' },
    'minimalist composition, negative space, clean lines, simple elegance': { label: '极简留白构图', icon: '⭕', color: 'slate' },
    
    // 增强效果映射
    'highly detailed, intricate details, ultra-detailed textures, photorealistic details': { label: '超高细节刻画', icon: '🔍', color: 'blue' },
    'cinematic composition, film photography, movie-like quality, Hollywood style': { label: '电影质感效果', icon: '🎬', color: 'purple' },
    'professional photography, studio quality, commercial grade, award-winning': { label: '专业摄影品质', icon: '📷', color: 'green' },
    'masterpiece, award winning, gallery quality, museum piece': { label: '艺术大师作品', icon: '👑', color: 'yellow' },
    'volumetric lighting, god rays, atmospheric lighting, light beams': { label: '体积光线效果', icon: '🌟', color: 'yellow' },
    'color grading, cinematic colors, film look, professional color correction': { label: '电影级色彩调色', icon: '🎨', color: 'purple' },
    'HDR photography, high dynamic range, enhanced contrast, vivid colors': { label: 'HDR高动态范围', icon: '🌈', color: 'cyan' },
    'film grain, analog photography, vintage film look, organic texture': { label: '胶片质感效果', icon: '📼', color: 'amber' },
  };

  // 🔥 改进的匹配逻辑
  // 1. 精确匹配
  if (tagMap[value]) {
    console.log(`✅ 精确匹配找到: ${value} -> ${tagMap[value].label}`);
    return tagMap[value];
  }

  // 2. 模糊匹配 - 检查是否包含关键词
  const normalizedValue = value.toLowerCase();
  
  // 特殊处理：根据调试信息中看到的具体值进行匹配
  if (normalizedValue.includes('photorealistic') && normalizedValue.includes('professional photography')) {
    console.log(`🎯 模糊匹配 - 摄影级逼真: ${value}`);
    return { label: '摄影级逼真效果', icon: '📸', color: 'blue' };
  }
  
  if (normalizedValue.includes('epic') && normalizedValue.includes('dramatic') && normalizedValue.includes('cinematic')) {
    console.log(`🎯 模糊匹配 - 震撼史诗: ${value}`);
    return { label: '震撼史诗氛围', icon: '⚡', color: 'orange' };
  }
  
  if (normalizedValue.includes('85mm') && normalizedValue.includes('portrait lens')) {
    console.log(`🎯 模糊匹配 - 85mm镜头: ${value}`);
    return { label: '85mm人像镜头', icon: '📷', color: 'blue' };
  }
  
  if (normalizedValue.includes('golden hour') && normalizedValue.includes('warm sunlight')) {
    console.log(`🎯 模糊匹配 - 黄金时刻: ${value}`);
    return { label: '黄金时刻光线', icon: '🌅', color: 'yellow' };
  }
  
  if (normalizedValue.includes('highly detailed') && normalizedValue.includes('ultra-detailed')) {
    console.log(`🎯 模糊匹配 - 超高细节: ${value}`);
    return { label: '超高细节刻画', icon: '🔍', color: 'blue' };
  }
  
  if (normalizedValue.includes('volumetric lighting') && normalizedValue.includes('god rays')) {
    console.log(`🎯 模糊匹配 - 体积光效: ${value}`);
    return { label: '体积光线效果', icon: '🌟', color: 'yellow' };
  }

  // 3. 通用关键词匹配
  const keywordMappings = [
    { keywords: ['photorealistic', 'hyperrealistic'], result: { label: '摄影级逼真', icon: '📸', color: 'blue' } },
    { keywords: ['cinematic', 'film photography'], result: { label: '电影级画质', icon: '🎬', color: 'purple' } },
    { keywords: ['epic', 'dramatic', 'powerful'], result: { label: '震撼史诗', icon: '⚡', color: 'orange' } },
    { keywords: ['85mm', 'portrait lens'], result: { label: '85mm镜头', icon: '📷', color: 'blue' } },
    { keywords: ['golden hour', 'warm sunlight'], result: { label: '黄金时刻', icon: '🌅', color: 'yellow' } },
    { keywords: ['highly detailed', 'intricate'], result: { label: '超高细节', icon: '🔍', color: 'blue' } },
    { keywords: ['volumetric lighting', 'god rays'], result: { label: '体积光效', icon: '🌟', color: 'yellow' } },
  ];

  for (const mapping of keywordMappings) {
    if (mapping.keywords.some(keyword => normalizedValue.includes(keyword))) {
      console.log(`🎯 关键词匹配: ${value} -> ${mapping.result.label}`);
      return mapping.result;
    }
  }

  // 4. 如果都没匹配到，返回简化的标签
  console.log(`⚠️ 未找到匹配，使用简化标签: ${value}`);
  return { label: value.substring(0, 15) + '...', icon: '🏷️', color: 'gray' };
};

// 从selectedTags提取特征信息
const getFeaturesFromSelectedTags = (result: GenerationResult) => {
  console.log('🔍 开始从selectedTags提取特征...');
  console.log('📦 原始result对象:', result);
  console.log('⚙️ result.config:', result.config);
  console.log('🏷️ result.config?.selectedTags:', result.config?.selectedTags);
  
  const selectedTags = result.config?.selectedTags || {};
  console.log('✅ 提取到的selectedTags:', selectedTags);

  const features = {
    artStyles: [] as { label: string; icon: string; color: string }[],
    themeStyles: [] as { label: string; icon: string; color: string }[],
    moods: [] as { label: string; icon: string; color: string }[],
    technicals: [] as { label: string; icon: string; color: string }[],
    compositions: [] as { label: string; icon: string; color: string }[],
    enhancements: [] as { label: string; icon: string; color: string }[]
  };

  // 艺术风格
  if (selectedTags.artStyle && selectedTags.artStyle.trim()) {
    console.log('🎨 处理艺术风格:', selectedTags.artStyle);
    features.artStyles.push(getTagDisplayInfo(selectedTags.artStyle, 'artStyle'));
  }

  // 主题风格
  if (selectedTags.themeStyle && selectedTags.themeStyle.trim()) {
    console.log('🏛️ 处理主题风格:', selectedTags.themeStyle);
    features.themeStyles.push(getTagDisplayInfo(selectedTags.themeStyle, 'themeStyle'));
  }

  // 情绪氛围
  if (selectedTags.mood && selectedTags.mood.trim()) {
    console.log('😊 处理情绪氛围:', selectedTags.mood);
    features.moods.push(getTagDisplayInfo(selectedTags.mood, 'mood'));
  }

  // 技术参数
  if (Array.isArray(selectedTags.technical) && selectedTags.technical.length > 0) {
    console.log('📷 处理技术参数数组:', selectedTags.technical);
    features.technicals = selectedTags.technical.map((tech: string) => getTagDisplayInfo(tech, 'technical'));
  } else if (selectedTags.technical && typeof selectedTags.technical === 'string' && (selectedTags.technical as string).trim()) {
    console.log('📷 处理技术参数字符串:', selectedTags.technical);
    features.technicals.push(getTagDisplayInfo(selectedTags.technical as string, 'technical'));
  }

  // 构图参数
  if (Array.isArray(selectedTags.composition) && selectedTags.composition.length > 0) {
    console.log('🖼️ 处理构图参数数组:', selectedTags.composition);
    features.compositions = selectedTags.composition.map((comp: string) => getTagDisplayInfo(comp, 'composition'));
  } else if (selectedTags.composition && typeof selectedTags.composition === 'string' && (selectedTags.composition as string).trim()) {
    console.log('🖼️ 处理构图参数字符串:', selectedTags.composition);
    features.compositions.push(getTagDisplayInfo(selectedTags.composition as string, 'composition'));
  }

  // 增强效果
  if (Array.isArray(selectedTags.enhancement) && selectedTags.enhancement.length > 0) {
    console.log('✨ 处理增强效果数组:', selectedTags.enhancement);
    features.enhancements = selectedTags.enhancement.map((enh: string) => getTagDisplayInfo(enh, 'enhancement'));
  } else if (selectedTags.enhancement && typeof selectedTags.enhancement === 'string' && (selectedTags.enhancement as string).trim()) {
    console.log('✨ 处理增强效果字符串:', selectedTags.enhancement);
    features.enhancements.push(getTagDisplayInfo(selectedTags.enhancement as string, 'enhancement'));
  }

  console.log('🎯 最终提取的features:', features);
  
  // 🔥 计算所有特征的总数
  const totalFeatures = features.artStyles.length + features.themeStyles.length + 
                       features.moods.length + features.technicals.length + 
                       features.compositions.length + features.enhancements.length;
  
  console.log(`📊 特征统计: 总计${totalFeatures}个特征`);
  console.log(`   - 艺术风格: ${features.artStyles.length}个`);
  console.log(`   - 主题风格: ${features.themeStyles.length}个`);
  console.log(`   - 情绪氛围: ${features.moods.length}个`);
  console.log(`   - 技术参数: ${features.technicals.length}个`);
  console.log(`   - 构图参数: ${features.compositions.length}个`);
  console.log(`   - 增强效果: ${features.enhancements.length}个`);

  return features;
};

// 内联显示组件 - 用于网格中的简化标签显示
export const PromptFeaturesInline: React.FC<{ result: GenerationResult }> = ({ result }) => {
  const modelInfo = getModelInfo(result.config.model);
  const features = getFeaturesFromSelectedTags(result);

  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {/* 模型标识 */}
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(modelInfo.color)}`}>
        {modelInfo.icon} {modelInfo.label}
      </span>

      {/* 🔥 优先显示主要风格标签 */}
      {features.artStyles.length > 0 && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(features.artStyles[0].color)}`}>
          {features.artStyles[0].icon} {features.artStyles[0].label}
        </span>
      )}
      
      {features.themeStyles.length > 0 && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(features.themeStyles[0].color)}`}>
          {features.themeStyles[0].icon} {features.themeStyles[0].label}
        </span>
      )}

      {features.moods.length > 0 && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(features.moods[0].color)}`}>
          {features.moods[0].icon} {features.moods[0].label}
        </span>
      )}

      {/* 品质标识 */}
      {features.enhancements.length > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
          ✨
        </span>
      )}

      {/* 🔥 显示所有技术增强效果 - 移除数量限制 */}
      {features.technicals.map((tech, index) => (
        <span 
          key={index}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorClasses(tech.color)}`}
        >
          {tech.icon} {tech.label}
        </span>
      ))}
    </div>
  );
};

// 详细特征显示组件 - 用于详情弹窗
export const PromptFeatures: React.FC<{ 
  result: GenerationResult;
  showBasePrompt?: boolean;
}> = ({ result, showBasePrompt = false }) => {
  const modelInfo = getModelInfo(result.config.model);
  const features = getFeaturesFromSelectedTags(result);

  return (
    <div className="space-y-3">
      {/* 基础描述 */}
      {showBasePrompt && result.prompt && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">📝 生成提示词</h4>
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
            {result.prompt}
          </p>
        </div>
      )}

      {/* 生成参数 */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 mb-1">⚙️ 生成参数</h4>
        <div className="flex flex-wrap gap-1">
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(modelInfo.color)}`}>
            <span className="mr-1">{modelInfo.icon}</span>
            {modelInfo.label}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
            📐 {result.config.aspectRatio || '1:1'}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200">
            🔢 {result.config.numInferenceSteps || 4}步
          </span>
        </div>
      </div>

      {/* 风格特征 */}
      {(features.artStyles.length > 0 || features.themeStyles.length > 0 || features.moods.length > 0) && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">🎨 风格特征</h4>
          <div className="flex flex-wrap gap-1">
            {features.artStyles.map((style, index) => (
              <span 
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(style.color)}`}
              >
                <span className="mr-1">{style.icon}</span>
                {style.label}
              </span>
            ))}
            {features.themeStyles.map((style, index) => (
              <span 
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(style.color)}`}
              >
                <span className="mr-1">{style.icon}</span>
                {style.label}
              </span>
            ))}
            {features.moods.map((mood, index) => (
              <span 
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(mood.color)}`}
              >
                <span className="mr-1">{mood.icon}</span>
                {mood.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 技术参数 */}
      {features.technicals.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">📷 技术参数</h4>
          <div className="flex flex-wrap gap-1">
            {features.technicals.map((tech, index) => (
              <span 
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(tech.color)}`}
              >
                <span className="mr-1">{tech.icon}</span>
                {tech.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 构图参数 */}
      {features.compositions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">🖼️ 构图参数</h4>
          <div className="flex flex-wrap gap-1">
            {features.compositions.map((comp, index) => (
              <span 
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(comp.color)}`}
              >
                <span className="mr-1">{comp.icon}</span>
                {comp.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 增强效果 */}
      {features.enhancements.length > 0 && (
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
          </div>
        </div>
      )}
    </div>
  );
}; 