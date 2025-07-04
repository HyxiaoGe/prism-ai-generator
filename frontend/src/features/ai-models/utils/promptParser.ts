// 提示词解析工具 - 将完整提示词解析成特征标签

export interface ParsedPromptFeatures {
  basePrompt: string;
  artStyle?: { label: string; icon: string; color: string };
  themeStyle?: { label: string; icon: string; color: string };
  mood?: { label: string; icon: string; color: string };
  enhancements: { label: string; icon: string; color: string }[];
  qualityEnhanced: boolean;
  model: string;
  aspectRatio: string;
  inferenceSteps: number;
}

// 艺术风格标签映射 - 完整版本
const ART_STYLE_MAP = new Map([
  ['photorealistic, hyperrealistic, professional photography, 8K ultra-detailed', { label: '摄影级逼真效果', icon: '📸', color: 'blue' }],
  ['cinematic photography, film photography, dramatic lighting, cinematic composition', { label: '电影级摄影画质', icon: '🎬', color: 'purple' }],
  ['oil painting, classical art, brush strokes, Renaissance style', { label: '经典油画风格', icon: '🎨', color: 'orange' }],
  ['watercolor painting, soft brushes, artistic, flowing colors', { label: '柔美水彩画风', icon: '🌈', color: 'cyan' }],
  ['anime style, manga, japanese animation, cel shading', { label: '日式动漫风格', icon: '🗾', color: 'pink' }],
  ['pixel art, 8-bit, retro gaming style, pixelated', { label: '复古像素艺术', icon: '🎮', color: 'purple' }],
  ['pencil sketch, black and white, hand drawn, charcoal drawing', { label: '手绘素描风格', icon: '✏️', color: 'gray' }],
  ['concept art, digital painting, matte painting, professional illustration', { label: '游戏概念艺术', icon: '🎯', color: 'indigo' }],
  ['3D render, CGI, ray tracing, volumetric lighting, subsurface scattering', { label: '3D渲染技术', icon: '🏗️', color: 'slate' }],
  ['impressionist style, soft focus, painterly, artistic brushwork', { label: '印象派艺术风格', icon: '🌅', color: 'amber' }],
]);

// 主题风格标签映射 - 完整版本
const THEME_STYLE_MAP = new Map([
  ['cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets', { label: '赛博朋克未来都市', icon: '🌃', color: 'purple' }],
  ['sci-fi, futuristic, space technology, holographic displays, advanced technology', { label: '科幻未来场景', icon: '🚀', color: 'blue' }],
  ['fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere', { label: '奇幻魔法世界', icon: '🧙‍♂️', color: 'indigo' }],
  ['steampunk, vintage machinery, brass gears, Victorian era, industrial', { label: '蒸汽朋克机械风', icon: '⚙️', color: 'amber' }],
  ['chinese style, traditional, elegant, ink wash painting, oriental aesthetics', { label: '中国传统古风', icon: '🏮', color: 'red' }],
  ['modern, minimalist, clean design, sleek, contemporary', { label: '现代简约设计', icon: '🏢', color: 'slate' }],
  ['retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave', { label: '复古未来主义', icon: '🌐', color: 'violet' }],
  ['biophilic design, organic forms, nature-inspired, eco-friendly, sustainable', { label: '自然生态风格', icon: '🌿', color: 'green' }],
  ['industrial design, metallic textures, concrete, raw materials, urban decay', { label: '工业废土风格', icon: '🏭', color: 'gray' }],
  ['gothic architecture, dark romantic, ornate details, mysterious atmosphere', { label: '哥特神秘风格', icon: '🏰', color: 'slate' }],
]);

// 情绪氛围标签映射 - 完整版本
const MOOD_MAP = new Map([
  ['warm lighting, bright, cheerful, golden hour, soft sunlight', { label: '温暖明亮氛围', icon: '☀️', color: 'yellow' }],
  ['dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro', { label: '神秘暗黑氛围', icon: '🌙', color: 'slate' }],
  ['dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like', { label: '梦幻唯美氛围', icon: '✨', color: 'violet' }],
  ['epic, dramatic, cinematic, powerful, grand scale, awe-inspiring', { label: '震撼史诗氛围', icon: '⚡', color: 'orange' }],
  ['peaceful, calm, serene, tranquil, meditation, zen atmosphere', { label: '宁静禅意氛围', icon: '🕊️', color: 'green' }],
  ['energetic, dynamic, vibrant, lively, high-energy, action-packed', { label: '活力动感氛围', icon: '🔥', color: 'red' }],
  ['melancholic, contemplative, nostalgic, bittersweet, introspective', { label: '忧郁沉思氛围', icon: '🌧️', color: 'blue' }],
  ['luxurious, elegant, sophisticated, premium, high-end, glamorous', { label: '奢华高贵氛围', icon: '💎', color: 'amber' }],
  ['wild, primal, untamed, rugged, natural, raw power', { label: '原始野性氛围', icon: '🦁', color: 'orange' }],
  ['futuristic, high-tech, digital, cyber, holographic, technological', { label: '未来科技氛围', icon: '🤖', color: 'cyan' }],
]);

// 增强效果标签映射 - 完整版本（包含技术参数、构图参数、增强效果）
const ENHANCEMENT_MAP = new Map([
  // 技术参数组
  ['85mm lens, portrait lens, shallow depth of field', { label: '85mm人像镜头', icon: '📷', color: 'blue' }],
  ['wide-angle lens, 24mm, expansive view, environmental context', { label: '24mm广角镜头', icon: '📐', color: 'blue' }],
  ['macro photography, extreme close-up, intricate details, magnified', { label: '微距特写摄影', icon: '🔍', color: 'green' }],
  ['telephoto lens, 200mm, compressed perspective, background blur', { label: '200mm长焦镜头', icon: '🎯', color: 'purple' }],
  ['fisheye lens, distorted perspective, 180-degree view, curved edges', { label: '鱼眼广角效果', icon: '🌐', color: 'cyan' }],
  ['shallow depth of field, f/1.4, bokeh effect, selective focus', { label: '浅景深虚化', icon: '✨', color: 'violet' }],
  ['deep focus, f/11, everything in focus, landscape photography', { label: '全景深清晰', icon: '🏔️', color: 'green' }],
  ['golden hour lighting, warm sunlight, magic hour, soft shadows', { label: '黄金时刻光线', icon: '🌅', color: 'yellow' }],
  ['blue hour, twilight, evening atmosphere, city lights', { label: '蓝调时刻光线', icon: '🌆', color: 'blue' }],
  ['studio lighting, softbox, professional lighting setup, controlled environment', { label: '专业工作室灯光', icon: '💡', color: 'amber' }],
  
  // 构图参数组
  ['rule of thirds, balanced composition, dynamic framing', { label: '三分法则构图', icon: '📐', color: 'indigo' }],
  ['centered composition, symmetrical, balanced, focal point', { label: '中心对称构图', icon: '🎯', color: 'indigo' }],
  ['low angle shot, worm eye view, heroic perspective, dramatic angle', { label: '低角度仰拍视角', icon: '📈', color: 'orange' }],
  ['high angle shot, bird eye view, overhead perspective, aerial view', { label: '高角度俯拍视角', icon: '📉', color: 'cyan' }],
  ['close-up shot, intimate framing, detailed focus, emotional connection', { label: '特写镜头构图', icon: '🔍', color: 'pink' }],
  ['wide shot, establishing shot, environmental context, full scene', { label: '全景镜头构图', icon: '🌄', color: 'green' }],
  ['medium shot, upper body, conversational framing, portrait style', { label: '肩部特写构图', icon: '👤', color: 'gray' }],
  ['extreme close-up, macro detail, textural focus, intimate detail', { label: '极近特写构图', icon: '👁️', color: 'violet' }],
  ['dynamic composition, diagonal lines, movement, energy', { label: '动态运动构图', icon: '⚡', color: 'red' }],
  ['minimalist composition, negative space, clean lines, simple elegance', { label: '极简留白构图', icon: '⭕', color: 'slate' }],
  
  // 效果增强组
  ['highly detailed, intricate details, ultra-detailed textures, photorealistic details', { label: '超高细节刻画', icon: '🔍', color: 'blue' }],
  ['cinematic composition, film photography, movie-like quality, Hollywood style', { label: '电影质感效果', icon: '🎬', color: 'purple' }],
  ['professional photography, studio quality, commercial grade, award-winning', { label: '专业摄影品质', icon: '📷', color: 'green' }],
  ['masterpiece, award winning, gallery quality, museum piece', { label: '艺术大师作品', icon: '👑', color: 'yellow' }],
  ['volumetric lighting, god rays, atmospheric lighting, light beams', { label: '体积光线效果', icon: '🌟', color: 'yellow' }],
  ['color grading, cinematic colors, film look, professional color correction', { label: '电影级色彩调色', icon: '🎨', color: 'purple' }],
  ['HDR photography, high dynamic range, enhanced contrast, vivid colors', { label: 'HDR高动态范围', icon: '🌈', color: 'cyan' }],
  ['film grain, analog photography, vintage film look, organic texture', { label: '胶片质感效果', icon: '📼', color: 'amber' }],
]);

// 模型标签映射 - 完整版本
const MODEL_MAP = new Map([
  ['flux-schnell', { label: 'Flux快速', icon: '⚡', color: 'blue' }],
  ['flux-dev', { label: 'Flux专业', icon: '🎯', color: 'purple' }],
  ['sdxl-lightning', { label: 'SDXL闪电', icon: '🌩️', color: 'yellow' }],
  ['sdxl-lightning-4step', { label: 'SDXL闪电4步', icon: '🌩️', color: 'yellow' }],
  ['stable-diffusion-xl', { label: 'SDXL经典', icon: '🏛️', color: 'gray' }],
  ['stable-diffusion', { label: 'SD经典', icon: '🎨', color: 'gray' }],
  ['imagen-4-ultra', { label: 'Imagen-4', icon: '🚀', color: 'green' }],
]);

/**
 * 解析完整提示词，提取特征标签
 */
export function parsePromptFeatures(prompt: string, config: any): ParsedPromptFeatures {
  const lowerPrompt = prompt.toLowerCase();
  const features: ParsedPromptFeatures = {
    basePrompt: extractBasePrompt(prompt),
    enhancements: [],
    qualityEnhanced: false,
    model: config.model || 'unknown',
    aspectRatio: config.aspectRatio || '1:1',
    inferenceSteps: config.numInferenceSteps || 4,
  };

  // 解析艺术风格（匹配完整或部分关键词）
  for (const [key, value] of ART_STYLE_MAP) {
    // 检查是否包含该艺术风格的关键词
    const keywords = key.split(', ');
    const matchCount = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    if (matchCount >= 2) { // 至少匹配2个关键词才算匹配
      features.artStyle = value;
      break;
    }
  }

  // 解析主题风格（匹配完整或部分关键词）
  for (const [key, value] of THEME_STYLE_MAP) {
    const keywords = key.split(', ');
    const matchCount = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    if (matchCount >= 2) { // 至少匹配2个关键词才算匹配
      features.themeStyle = value;
      break;
    }
  }

  // 解析情绪氛围（匹配完整或部分关键词）
  for (const [key, value] of MOOD_MAP) {
    const keywords = key.split(', ');
    const matchCount = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    if (matchCount >= 2) { // 至少匹配2个关键词才算匹配
      features.mood = value;
      break;
    }
  }

  // 解析增强效果（包括技术参数、构图参数等）
  for (const [key, value] of ENHANCEMENT_MAP) {
    const keywords = key.split(', ');
    const matchCount = keywords.filter(keyword => lowerPrompt.includes(keyword)).length;
    if (matchCount >= 2) { // 至少匹配2个关键词才算匹配
      features.enhancements.push(value);
    }
  }

  // 检查品质增强
  features.qualityEnhanced = lowerPrompt.includes('high quality') || 
                            lowerPrompt.includes('masterpiece') || 
                            lowerPrompt.includes('4k resolution') ||
                            lowerPrompt.includes('best quality') ||
                            lowerPrompt.includes('detailed');

  return features;
}

/**
 * 提取基础提示词（移除标签后的核心描述）
 * 基于完整的标签系统进行全面清理
 */
function extractBasePrompt(prompt: string): string {
  let basePrompt = prompt;
  
  // 完整的技术术语清理规则 - 基于所有标签系统
  const allTechnicalTerms = [
    // === 艺术风格术语 ===
    // 摄影级逼真
    'photorealistic', 'hyperrealistic', 'professional photography', '8K ultra-detailed', '8k',
    // 电影级画质  
    'cinematic photography', 'film photography', 'dramatic lighting', 'cinematic composition',
    // 油画风格
    'oil painting', 'classical art', 'brush strokes', 'Renaissance style', 'renaissance',
    // 水彩画
    'watercolor painting', 'soft brushes', 'artistic', 'flowing colors', 'watercolor',
    // 动漫风格
    'anime style', 'manga', 'japanese animation', 'cel shading', 'anime',
    // 像素艺术
    'pixel art', '8-bit', 'retro gaming style', 'pixelated', 'pixel',
    // 素描风格
    'pencil sketch', 'black and white', 'hand drawn', 'charcoal drawing', 'sketch',
    // 概念艺术
    'concept art', 'digital painting', 'matte painting', 'professional illustration', 'illustration',
    // 3D渲染
    '3D render', 'CGI', 'ray tracing', 'volumetric lighting', 'subsurface scattering', '3d', 'cgi',
    // 印象派
    'impressionist style', 'soft focus', 'painterly', 'artistic brushwork', 'impressionist',
    
    // === 主题风格术语 ===
    // 赛博朋克
    'cyberpunk', 'neon lights', 'futuristic city', 'dystopian', 'rain-soaked streets',
    // 科幻场景
    'sci-fi', 'futuristic', 'space technology', 'holographic displays', 'advanced technology', 'holographic',
    // 奇幻风格
    'fantasy', 'magical', 'mythical creatures', 'enchanted forest', 'mystical atmosphere', 'enchanted', 'mystical',
    // 蒸汽朋克
    'steampunk', 'vintage machinery', 'brass gears', 'Victorian era', 'industrial', 'victorian',
    // 中国风
    'chinese style', 'traditional', 'elegant', 'ink wash painting', 'oriental aesthetics', 'oriental',
    // 现代简约
    'modern', 'minimalist', 'clean design', 'sleek', 'contemporary',
    // 复古未来
    'retro-futurism', 'vintage sci-fi', '80s aesthetic', 'synthwave', 'vaporwave', 'retro',
    // 自然生态
    'biophilic design', 'organic forms', 'nature-inspired', 'eco-friendly', 'sustainable', 'biophilic',
    // 工业风格
    'industrial design', 'metallic textures', 'concrete', 'raw materials', 'urban decay', 'metallic',
    // 哥特风格
    'gothic architecture', 'dark romantic', 'ornate details', 'mysterious atmosphere', 'gothic', 'ornate',
    
    // === 情绪氛围术语 ===
    // 温暖明亮
    'warm lighting', 'bright', 'cheerful', 'golden hour', 'soft sunlight',
    // 神秘暗黑
    'dark', 'mysterious', 'moody lighting', 'deep shadows', 'dramatic chiaroscuro', 'chiaroscuro',
    // 梦幻唯美
    'dreamy', 'ethereal', 'soft', 'beautiful', 'pastel colors', 'fairy-tale like', 'pastel', 'fairy-tale',
    // 震撼史诗
    'epic', 'dramatic', 'cinematic', 'powerful', 'grand scale', 'awe-inspiring',
    // 宁静平和
    'peaceful', 'calm', 'serene', 'tranquil', 'meditation', 'zen atmosphere', 'zen',
    // 活力动感
    'energetic', 'dynamic', 'vibrant', 'lively', 'high-energy', 'action-packed',
    // 忧郁沉思
    'melancholic', 'contemplative', 'nostalgic', 'bittersweet', 'introspective',
    // 奢华高贵
    'luxurious', 'elegant', 'sophisticated', 'premium', 'high-end', 'glamorous',
    // 原始野性
    'wild', 'primal', 'untamed', 'rugged', 'natural', 'raw power', 'primal',
    // 未来科技
    'futuristic', 'high-tech', 'digital', 'cyber', 'holographic', 'technological',
    
    // === 技术参数术语 ===
    '85mm lens', 'portrait lens', 'shallow depth of field', '85mm',
    'wide-angle lens', '24mm', 'expansive view', 'environmental context',
    'macro photography', 'extreme close-up', 'intricate details', 'magnified', 'macro',
    'telephoto lens', '200mm', 'compressed perspective', 'background blur', 'telephoto',
    'fisheye lens', 'distorted perspective', '180-degree view', 'curved edges', 'fisheye',
    'f/1.4', 'f/11', 'bokeh effect', 'selective focus', 'bokeh',
    'deep focus', 'everything in focus', 'landscape photography',
    'magic hour', 'blue hour', 'twilight', 'evening atmosphere', 'city lights',
    'studio lighting', 'softbox', 'professional lighting setup', 'controlled environment', 'softbox',
    'golden hour lighting', 'warm sunlight', 'soft shadows',
    
    // === 构图参数术语 ===
    'rule of thirds', 'balanced composition', 'dynamic framing',
    'centered composition', 'symmetrical', 'balanced', 'focal point',
    'low angle shot', 'worm eye view', 'heroic perspective', 'dramatic angle',
    'high angle shot', 'bird eye view', 'overhead perspective', 'aerial view', 'aerial',
    'close-up shot', 'intimate framing', 'detailed focus', 'emotional connection',
    'wide shot', 'establishing shot', 'environmental context', 'full scene',
    'medium shot', 'upper body', 'conversational framing', 'portrait style',
    'extreme close-up', 'macro detail', 'textural focus', 'intimate detail',
    'dynamic composition', 'diagonal lines', 'movement', 'energy',
    'minimalist composition', 'negative space', 'clean lines', 'simple elegance',
    
    // === 效果增强术语 ===
    'highly detailed', 'ultra-detailed textures', 'photorealistic details',
    'movie-like quality', 'Hollywood style', 'hollywood',
    'studio quality', 'commercial grade', 'award-winning',
    'masterpiece', 'award winning', 'gallery quality', 'museum piece',
    'god rays', 'atmospheric lighting', 'light beams',
    'color grading', 'cinematic colors', 'film look', 'professional color correction',
    'HDR photography', 'high dynamic range', 'enhanced contrast', 'vivid colors', 'hdr',
    'film grain', 'analog photography', 'vintage film look', 'organic texture', 'analog',
    
    // === 负面提示词术语 ===
    'blurry', 'out of focus', 'motion blur',
    'low quality', 'compressed', 'artifact', 'noise',
    'distorted', 'deformed', 'mutated', 'disfigured', 'anatomical errors',
    'overexposed', 'blown out highlights', 'washed out', 'too bright', 'underexposed',
    'cartoonish', 'drawing', 'painted',
    'copy paste', 'repetitive', 'tiled', 'pattern artifacts',
    
    // === 品质增强术语 ===
    'high quality', 'detailed', 'best quality', '4k resolution', '4k',
    'ultra high quality', 'professional grade',
    'premium quality', 'top quality', 'excellent quality',
    'ultra-detailed', 'ultra realistic', 'ultra',
    
    // === 通用技术术语 ===
    'lighting', 'illumination', 'brightness', 'contrast',
    'composition', 'framing', 'angle', 'perspective',
    'focus', 'blur', 'sharpness', 'clarity',
    'exposure', 'saturation', 'vibrance', 'tone',
    'texture', 'pattern', 'surface', 'material',
    'atmosphere', 'mood', 'ambiance', 'feeling',
    'scale', 'context', 'range', 'ratio', 'proportion',
    'size', 'dimension', 'format', 'aspect',
    'effect', 'filter', 'processing', 'enhancement', 'improvement',
    'quality', 'resolution', 'render', 'rendering',
    'professional', 'studio', 'commercial', 'award',
    'setup', 'grade', 'level', 'type',
    'photography', 'film', 'digital', 'art', 'style', 'design',
    
    // === 常见形容词 ===
    'romantic', 'baroque', 'classical', 'neoclassical',
    'atmospheric', 'vintage', 'moody',
    'shadows', 'highlights', 'vivid',
    'deep', 'shallow', 'wide', 'narrow', 'broad',
    'high', 'low', 'extreme', 'maximum', 'minimum',
    'smooth', 'rough', 'sharp', 'soft', 'hard',
    'warm', 'cool', 'hot', 'cold',
    'large', 'small', 'big', 'tiny', 'huge',
    'clean', 'dirty', 'pure', 'raw',
    'rich', 'poor', 'dense', 'sparse',
    'thick', 'thin', 'heavy', 'light',
    'strong', 'weak', 'intense', 'subtle',
  ];
  
  // 创建正则表达式来匹配所有技术术语
  const technicalRegexes = [
    // 匹配完整短语（用引号或逗号分隔）
    new RegExp(',?\\s*(' + allTechnicalTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=\\s*,|\\s*$)', 'gi'),
    
    // 匹配单独的技术词汇（词边界）
    new RegExp('\\b(' + allTechnicalTerms.filter(term => !term.includes(' ')).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi'),
    
    // 清理其他常见模式
    /,?\s*\d+mm\b/gi,                    // 镜头焦距
    /,?\s*f\/\d+\.?\d*/gi,               // 光圈值
    /,?\s*\d+k\s*resolution/gi,          // 分辨率
    /,?\s*\d+k\b/gi,                     // 简化分辨率
    /,?\s*\b\w+\s*-\s*\w+\b/gi,          // 连字符组合词
    /,?\s*illustn?/gi,                   // illustration的缩写
    /,?\s*matte\s*painting/gi,           // matte painting
    /,?\s*colors?/gi,                    // color/colors
  ];
  
  // 应用所有清理规则
  technicalRegexes.forEach(regex => {
    basePrompt = basePrompt.replace(regex, '');
  });
  
  // 最终清理：处理剩余的格式问题
  basePrompt = basePrompt
    .replace(/,+\s*,+/g, ',')             // 多个连续逗号
    .replace(/^,+\s*|,+\s*$/g, '')        // 开头结尾的逗号
    .replace(/\s+,/g, ',')                // 逗号前的空格
    .replace(/,\s+/g, ', ')               // 规范化逗号后空格
    .replace(/\s+/g, ' ')                 // 多个空格
    .replace(/\.\s*,/g, '.')              // 句号后的逗号
    .replace(/\s*,\s*$/g, '')             // 结尾逗号
    .trim();
  
  return basePrompt;
}

/**
 * 获取模型信息标签
 */
export function getModelInfo(modelId: string) {
  return MODEL_MAP.get(modelId) || { label: modelId, icon: '🤖', color: 'gray' };
}

/**
 * 生成颜色类名
 */
export function getColorClasses(color: string) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    violet: 'bg-violet-100 text-violet-800 border-violet-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  
  return colorMap[color as keyof typeof colorMap] || colorMap.gray;
} 