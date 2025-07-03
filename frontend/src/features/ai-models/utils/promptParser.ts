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

// 艺术风格标签映射
const ART_STYLE_MAP = new Map([
  ['photorealistic', { label: '摄影级', icon: '📸', color: 'blue' }],
  ['oil painting', { label: '油画', icon: '🎨', color: 'orange' }],
  ['watercolor', { label: '水彩', icon: '🌈', color: 'cyan' }],
  ['anime style', { label: '动漫', icon: '🗾', color: 'pink' }],
  ['pixel art', { label: '像素', icon: '🎮', color: 'purple' }],
  ['pencil sketch', { label: '素描', icon: '✏️', color: 'gray' }],
]);

// 主题风格标签映射
const THEME_STYLE_MAP = new Map([
  ['cyberpunk', { label: '赛博朋克', icon: '🌃', color: 'purple' }],
  ['sci-fi', { label: '科幻', icon: '🚀', color: 'blue' }],
  ['fantasy', { label: '奇幻', icon: '🧙‍♂️', color: 'indigo' }],
  ['steampunk', { label: '蒸汽朋克', icon: '⚙️', color: 'amber' }],
  ['chinese style', { label: '中国风', icon: '🏮', color: 'red' }],
  ['modern', { label: '现代', icon: '🏢', color: 'slate' }],
]);

// 情绪氛围标签映射
const MOOD_MAP = new Map([
  ['warm lighting', { label: '温暖', icon: '☀️', color: 'yellow' }],
  ['dark', { label: '暗黑', icon: '🌙', color: 'slate' }],
  ['dreamy', { label: '梦幻', icon: '✨', color: 'violet' }],
  ['epic', { label: '史诗', icon: '⚡', color: 'orange' }],
  ['peaceful', { label: '宁静', icon: '🕊️', color: 'green' }],
  ['energetic', { label: '活力', icon: '🔥', color: 'red' }],
]);

// 增强效果标签映射
const ENHANCEMENT_MAP = new Map([
  ['highly detailed', { label: '高细节', icon: '🔍', color: 'blue' }],
  ['cinematic', { label: '电影感', icon: '🎬', color: 'purple' }],
  ['professional photography', { label: '专业摄影', icon: '📷', color: 'green' }],
  ['masterpiece', { label: '大师级', icon: '👑', color: 'yellow' }],
  ['high quality', { label: '高品质', icon: '💎', color: 'cyan' }],
  ['composition', { label: '精美构图', icon: '🖼️', color: 'indigo' }],
  ['perfect composition', { label: '完美构图', icon: '🎯', color: 'indigo' }],
  ['rule of thirds', { label: '三分构图', icon: '📐', color: 'indigo' }],
  ['depth of field', { label: '景深效果', icon: '🌅', color: 'blue' }],
  ['bokeh', { label: '虚化背景', icon: '✨', color: 'violet' }],
]);

// 模型标签映射
const MODEL_MAP = new Map([
  ['flux-schnell', { label: 'Flux快速', icon: '⚡', color: 'blue' }],
  ['flux-dev', { label: 'Flux专业', icon: '🎯', color: 'purple' }],
  ['sdxl-lightning', { label: 'SDXL闪电', icon: '🌩️', color: 'yellow' }],
  ['stable-diffusion-xl', { label: 'SDXL经典', icon: '🏛️', color: 'gray' }],
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

  // 解析艺术风格
  for (const [key, value] of ART_STYLE_MAP) {
    if (lowerPrompt.includes(key)) {
      features.artStyle = value;
      break;
    }
  }

  // 解析主题风格
  for (const [key, value] of THEME_STYLE_MAP) {
    if (lowerPrompt.includes(key)) {
      features.themeStyle = value;
      break;
    }
  }

  // 解析情绪氛围
  for (const [key, value] of MOOD_MAP) {
    if (lowerPrompt.includes(key)) {
      features.mood = value;
      break;
    }
  }

  // 解析增强效果
  for (const [key, value] of ENHANCEMENT_MAP) {
    if (lowerPrompt.includes(key)) {
      features.enhancements.push(value);
    }
  }

  // 检查品质增强
  features.qualityEnhanced = lowerPrompt.includes('high quality') || 
                            lowerPrompt.includes('masterpiece') || 
                            lowerPrompt.includes('4k resolution');

  return features;
}

/**
 * 提取基础提示词（移除标签后的核心描述）
 */
function extractBasePrompt(prompt: string): string {
  let basePrompt = prompt;
  
  // 移除常见的增强词汇
  const toRemove = [
    // 艺术风格术语
    /,?\s*(photorealistic|hyperrealistic|professional photography)/gi,
    /,?\s*(oil painting|classical art|brush strokes)/gi,
    /,?\s*(watercolor painting|soft brushes|artistic)/gi,
    /,?\s*(anime style|manga|japanese animation)/gi,
    /,?\s*(pixel art|8-bit|retro gaming style)/gi,
    /,?\s*(pencil sketch|black and white|hand drawn)/gi,
    
    // 主题风格术语
    /,?\s*(cyberpunk|neon lights|futuristic city)/gi,
    /,?\s*(sci-fi|futuristic|space technology)/gi,
    /,?\s*(fantasy|magical|mythical creatures)/gi,
    /,?\s*(steampunk|vintage machinery|brass gears)/gi,
    /,?\s*(chinese style|traditional|elegant)/gi,
    /,?\s*(modern|minimalist|clean design)/gi,
    
    // 光线和氛围术语
    /,?\s*(warm lighting|bright|cheerful|golden hour)/gi,
    /,?\s*(dark|mysterious|moody lighting|shadows)/gi,
    /,?\s*(dreamy|ethereal|soft|beautiful|pastel)/gi,
    /,?\s*(epic|dramatic|cinematic|powerful|grand)/gi,
    /,?\s*(peaceful|calm|serene|tranquil)/gi,
    /,?\s*(energetic|dynamic|vibrant|lively)/gi,
    
    // 技术增强术语
    /,?\s*(highly detailed|intricate details)/gi,
    /,?\s*(cinematic composition|film photography)/gi,
    /,?\s*(professional photography|studio lighting)/gi,
    /,?\s*(masterpiece|award winning)/gi,
    /,?\s*(high quality|detailed|best quality|4k resolution)/gi,
    
    // 摄影和构图技术术语
    /,?\s*(composition|framing|rule of thirds)/gi,
    /,?\s*(depth of field|bokeh|shallow focus|sharp focus)/gi,
    /,?\s*(wide angle|telephoto|macro|close-up)/gi,
    /,?\s*(portrait|landscape orientation)/gi,
    /,?\s*(symmetrical|asymmetrical|balanced)/gi,
    /,?\s*(leading lines|negative space|foreground)/gi,
    /,?\s*(background|mid-ground|perspective)/gi,
    /,?\s*(lighting setup|studio setup|natural lighting)/gi,
    /,?\s*(exposure|contrast|saturation|vibrance)/gi,
    /,?\s*(color grading|post-processing|edited)/gi,
  ];

  toRemove.forEach(regex => {
    basePrompt = basePrompt.replace(regex, '');
  });

  // 清理多余的逗号和空格
  basePrompt = basePrompt.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
  
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