/**
 * 场景模板配置文件
 * 定义分类图标、渐变色、标签等常量
 */

// 分类图标映射
export const CATEGORY_ICONS: Record<string, string> = {
  '摄影艺术': '📷',
  'anime': '🎌',
  'game': '🎮',
  'painting': '🎨',
  'concept': '💡',
  'chinese': '🏯',
  'cartoon': '🎭',
  'dark': '🌙',
  'steampunk': '⚙️',
  'dieselpunk': '🔧',
  'nature': '🌿',
  'architecture': '🏛️',
};

// 分类中文名称映射
export const CATEGORY_LABELS: Record<string, string> = {
  '摄影艺术': '摄影艺术',
  'anime': '日系动漫',
  'game': '游戏风格',
  'painting': '绘画艺术',
  'concept': '概念设计',
  'chinese': '中国风',
  'cartoon': '卡通插画',
  'dark': '暗黑风格',
  'steampunk': '蒸汽朋克',
  'dieselpunk': '柴油朋克',
  'nature': '自然生态',
  'architecture': '建筑设计',
  'all': '全部模板',
};

// 分类描述
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  '摄影艺术': '专业摄影风格，工作室级质量',
  'anime': '日本动漫风格，充满活力',
  'game': '游戏场景和角色设计',
  'painting': '传统和数字绘画艺术',
  'concept': '概念艺术和设计稿',
  'chinese': '东方美学，传统与现代结合',
  'cartoon': '可爱卡通和插画风格',
  'dark': '神秘、哥特、恐怖氛围',
  'steampunk': '维多利亚时代机械美学',
  'dieselpunk': '二战工业风格',
  'nature': '自然风光和生物摄影',
  'architecture': '建筑和空间设计',
};

// 分类渐变色背景（用于缩略图占位符）
export const CATEGORY_GRADIENTS: Record<string, string> = {
  '摄影艺术': 'from-blue-400 via-indigo-500 to-purple-600',
  'anime': 'from-pink-400 via-rose-500 to-red-600',
  'game': 'from-green-400 via-teal-500 to-cyan-600',
  'painting': 'from-orange-400 via-amber-500 to-yellow-600',
  'concept': 'from-purple-400 via-violet-500 to-indigo-600',
  'chinese': 'from-red-500 via-orange-600 to-yellow-500',
  'cartoon': 'from-sky-400 via-blue-500 to-indigo-600',
  'dark': 'from-gray-800 via-gray-900 to-black',
  'steampunk': 'from-amber-600 via-orange-700 to-brown-800',
  'dieselpunk': 'from-slate-600 via-gray-700 to-zinc-800',
  'nature': 'from-green-500 via-emerald-600 to-teal-700',
  'architecture': 'from-slate-400 via-gray-500 to-zinc-600',
};

// 难度标签映射
export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

// 难度颜色映射
export const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  beginner: { bg: 'bg-green-100', text: 'text-green-700' },
  intermediate: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  advanced: { bg: 'bg-red-100', text: 'text-red-700' },
};

// 排序选项
export const SORT_OPTIONS = [
  { value: 'popular', label: '最热门' },
  { value: 'rating', label: '最高分' },
  { value: 'newest', label: '最新' },
  { value: 'usage', label: '使用最多' },
] as const;

// 默认显示数量
export const DEFAULT_LIMITS = {
  FEATURED: 8,           // 首页热门推荐显示数量
  CATEGORY_PREVIEW: 3,   // 每个分类预览显示数量
  MAX_CATEGORIES: 6,     // 首页最多显示分类数量
  SEARCH_RESULTS: 20,    // 搜索结果数量
};

/**
 * 根据分类获取渐变色
 */
export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] || 'from-purple-400 via-blue-500 to-indigo-600';
}

/**
 * 根据分类获取图标
 */
export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || '✨';
}

/**
 * 根据分类获取标签
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * 根据分类获取描述
 */
export function getCategoryDescription(category: string): string {
  return CATEGORY_DESCRIPTIONS[category] || '';
}
