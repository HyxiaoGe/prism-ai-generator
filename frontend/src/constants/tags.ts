/**
 * 标签定义常量
 * 统一管理所有提示词标签的定义和映射
 */

import type { TagCategory } from '../types/database';

// ===== 标签类型定义 =====

export interface Tag {
  label: string;      // 中文标签名（用于UI显示）
  value: string;      // 英文提示词值（用于生成）
  displayValue: string; // 详细中文描述（用于提示）
}

export interface SceneTemplate {
  label: string;
  prompt: string;
  technical: string;
  lighting: string;
  mood: string;
}

// ===== 艺术风格组（单选 - 避免风格冲突）=====

export const ART_STYLE_TAGS: Tag[] = [
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

// ===== 主题风格组（单选 - 避免主题冲突）=====

export const THEME_STYLE_TAGS: Tag[] = [
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

// ===== 情绪氛围组（单选 - 避免情绪冲突）=====

export const MOOD_TAGS: Tag[] = [
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

// ===== 技术参数组（可多选）=====

export const TECHNICAL_TAGS: Tag[] = [
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

// ===== 构图参数组（可多选）=====

export const COMPOSITION_TAGS: Tag[] = [
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

// ===== 增强属性组（可多选 - 不冲突的增强属性）=====

export const ENHANCEMENT_TAGS: Tag[] = [
  { label: '超高细节', value: 'highly detailed, intricate details, ultra-detailed textures, photorealistic details', displayValue: '超高细节刻画' },
  { label: '电影感', value: 'cinematic composition, film photography, movie-like quality, Hollywood style', displayValue: '电影质感效果' },
  { label: '专业摄影', value: 'professional photography, studio quality, commercial grade, award-winning', displayValue: '专业摄影品质' },
  { label: '艺术大师', value: 'masterpiece, award winning, gallery quality, museum piece', displayValue: '艺术大师作品' },
  { label: '体积光效', value: 'volumetric lighting, god rays, atmospheric lighting, light beams', displayValue: '体积光线效果' },
  { label: '色彩分级', value: 'color grading, cinematic colors, film look, professional color correction', displayValue: '电影级色彩调色' },
  { label: 'HDR效果', value: 'HDR photography, high dynamic range, enhanced contrast, vivid colors', displayValue: 'HDR高动态范围' },
  { label: '胶片质感', value: 'film grain, analog photography, vintage film look, organic texture', displayValue: '胶片质感效果' },
];

// ===== 场景预设模板 =====

export const SCENE_TEMPLATES: SceneTemplate[] = [
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

// ===== 主题建议 =====

export const SUBJECT_SUGGESTIONS: string[] = [
  '美丽的风景画',
  '未来城市天际线',
  '可爱的动物',
  '科幻机器人',
  '奇幻生物',
  '抽象艺术',
  '人物肖像',
  '静物摄影',
];

// ===== 质量增强词汇 =====

export const QUALITY_ENHANCEMENT = 'high quality, detailed, masterpiece, best quality, 4k resolution';

// ===== 标签名称映射表（英文value -> 中文label）=====

export const TAG_NAME_MAP: Record<string, string> = {
  // 艺术风格组
  'photorealistic, hyperrealistic, professional photography, 8K ultra-detailed': '摄影级逼真',
  'cinematic photography, film photography, dramatic lighting, cinematic composition': '电影级画质',
  'oil painting, classical art, brush strokes, Renaissance style': '油画风格',
  'watercolor painting, soft brushes, artistic, flowing colors': '水彩画',
  'anime style, manga, japanese animation, cel shading': '动漫风格',
  'pixel art, 8-bit, retro gaming style, pixelated': '像素艺术',
  'pencil sketch, black and white, hand drawn, charcoal drawing': '素描风格',
  'concept art, digital painting, matte painting, professional illustration': '概念艺术',
  '3D render, CGI, ray tracing, volumetric lighting, subsurface scattering': '3D渲染',
  'impressionist style, soft focus, painterly, artistic brushwork': '印象派',

  // 主题风格组
  'cyberpunk, neon lights, futuristic city, dystopian, rain-soaked streets': '赛博朋克',
  'sci-fi, futuristic, space technology, holographic displays, advanced technology': '科幻场景',
  'fantasy, magical, mythical creatures, enchanted forest, mystical atmosphere': '奇幻风格',
  'steampunk, vintage machinery, brass gears, Victorian era, industrial': '蒸汽朋克',
  'chinese style, traditional, elegant, ink wash painting, oriental aesthetics': '中国风',
  'modern, minimalist, clean design, sleek, contemporary': '现代简约',
  'retro-futurism, vintage sci-fi, 80s aesthetic, synthwave, vaporwave': '复古未来',
  'biophilic design, organic forms, nature-inspired, eco-friendly, sustainable': '自然生态',
  'industrial design, metallic textures, concrete, raw materials, urban decay': '工业风格',
  'gothic architecture, dark romantic, ornate details, mysterious atmosphere': '哥特风格',

  // 情绪氛围组
  'warm lighting, bright, cheerful, golden hour, soft sunlight': '温暖明亮',
  'dark, mysterious, moody lighting, deep shadows, dramatic chiaroscuro': '神秘暗黑',
  'dreamy, ethereal, soft, beautiful, pastel colors, fairy-tale like': '梦幻唯美',
  'epic, dramatic, cinematic, powerful, grand scale, awe-inspiring': '震撼史诗',
  'peaceful, calm, serene, tranquil, meditation, zen atmosphere': '宁静平和',
  'energetic, dynamic, vibrant, lively, high-energy, action-packed': '活力动感',
  'melancholic, contemplative, nostalgic, bittersweet, introspective': '忧郁沉思',
  'luxurious, elegant, sophisticated, premium, high-end, glamorous': '奢华高贵',
  'wild, primal, untamed, rugged, natural, raw power': '原始野性',
  'futuristic, high-tech, digital, cyber, holographic, technological': '未来科技',

  // 技术参数组
  '85mm lens, portrait lens, shallow depth of field': '85mm镜头',
  'wide-angle lens, 24mm, expansive view, environmental context': '广角镜头',
  'macro photography, extreme close-up, intricate details, magnified': '微距摄影',
  'telephoto lens, 200mm, compressed perspective, background blur': '长焦镜头',
  'fisheye lens, distorted perspective, 180-degree view, curved edges': '鱼眼效果',
  'shallow depth of field, f/1.4, bokeh effect, selective focus': '景深控制',
  'deep focus, f/11, everything in focus, landscape photography': '全景深',
  'golden hour lighting, warm sunlight, magic hour, soft shadows': '黄金时刻',
  'blue hour, twilight, evening atmosphere, city lights': '蓝调时刻',
  'studio lighting, softbox, professional lighting setup, controlled environment': '工作室灯光',

  // 构图参数组
  'rule of thirds, balanced composition, dynamic framing': '三分法则',
  'centered composition, symmetrical, balanced, focal point': '中心构图',
  'low angle shot, worm eye view, heroic perspective, dramatic angle': '低角度仰拍',
  'high angle shot, bird eye view, overhead perspective, aerial view': '高角度俯拍',
  'close-up shot, intimate framing, detailed focus, emotional connection': '特写镜头',
  'wide shot, establishing shot, environmental context, full scene': '全景镜头',
  'medium shot, upper body, conversational framing, portrait style': '肩部特写',
  'extreme close-up, macro detail, textural focus, intimate detail': '极近特写',
  'dynamic composition, diagonal lines, movement, energy': '动态构图',
  'minimalist composition, negative space, clean lines, simple elegance': '极简构图',

  // 增强属性组
  'highly detailed, intricate details, ultra-detailed textures, photorealistic details': '超高细节',
  'cinematic composition, film photography, movie-like quality, Hollywood style': '电影感',
  'professional photography, studio quality, commercial grade, award-winning': '专业摄影',
  'masterpiece, award winning, gallery quality, museum piece': '艺术大师',
  'volumetric lighting, god rays, atmospheric lighting, light beams': '体积光效',
  'color grading, cinematic colors, film look, professional color correction': '色彩分级',
  'HDR photography, high dynamic range, enhanced contrast, vivid colors': 'HDR效果',
  'film grain, analog photography, vintage film look, organic texture': '胶片质感',
  'high quality, detailed, masterpiece, best quality, 4k resolution': '品质增强',
};

// ===== 辅助函数 =====

/**
 * 根据英文 value 获取中文显示名称
 */
export function getTagDisplayName(value: string): string {
  // 完全匹配
  if (TAG_NAME_MAP[value]) {
    return TAG_NAME_MAP[value];
  }

  // 部分匹配
  for (const [englishValue, chineseName] of Object.entries(TAG_NAME_MAP)) {
    if (value.includes(englishValue) || englishValue.includes(value)) {
      return chineseName;
    }
  }

  // 如果都没找到，返回截取的英文值
  console.warn('⚠️ 未找到标签映射:', value);
  return value.length > 50 ? value.substring(0, 50) + '...' : value;
}

/**
 * 根据 value 查找对应的中文 displayValue
 */
export function getDisplayValue(value: string, tagGroups: Tag[][]): string {
  for (const group of tagGroups) {
    const tag = group.find(tag => tag.value === value);
    if (tag) return tag.displayValue || tag.label;
  }
  return value;
}

/**
 * 所有标签组（用于遍历查找）
 */
export const ALL_TAG_GROUPS: Tag[][] = [
  ART_STYLE_TAGS,
  THEME_STYLE_TAGS,
  MOOD_TAGS,
  TECHNICAL_TAGS,
  COMPOSITION_TAGS,
  ENHANCEMENT_TAGS,
];

/**
 * 根据分类获取标签组
 */
export function getTagsByCategory(category: TagCategory): Tag[] {
  switch (category) {
    case 'art_style':
      return ART_STYLE_TAGS;
    case 'theme_style':
      return THEME_STYLE_TAGS;
    case 'mood':
      return MOOD_TAGS;
    case 'technical':
      return TECHNICAL_TAGS;
    case 'composition':
      return COMPOSITION_TAGS;
    case 'enhancement':
      return ENHANCEMENT_TAGS;
    default:
      return [];
  }
}
