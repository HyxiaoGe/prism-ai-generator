/**
 * 场景包定义
 * 为新手用户提供预设的场景组合，简化参数选择
 */

// ===== 类型定义 =====

export interface ScenePack {
  id: string;                    // 唯一标识
  name: string;                  // 中文名称
  nameEn: string;                // 英文名称
  icon: string;                  // 图标 emoji
  category: 'portrait' | 'landscape' | 'art' | 'design' | 'product' | 'other';
  preview: string;               // 预览图路径
  description: string;           // 场景描述
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // 标签配置
  tags: {
    artStyle?: string;           // 艺术风格（单选）
    themeStyle?: string;         // 主题风格（单选）
    mood?: string;               // 情绪氛围（单选）
    technical?: string[];        // 技术参数（多选）
    composition?: string[];      // 构图参数（多选）
    enhancement?: string[];      // 增强效果（多选）
  };

  // 推荐配置
  recommendedModel: string;      // 推荐模型
  // recommendedAspectRatio: string; // 推荐宽高比
  recommendedAspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  recommendedSteps?: number;     // 推荐步数

  // 辅助信息
  examples: string[];            // 示例描述
  tips?: string;                 // 使用提示
  usageCount?: number;           // 使用次数（用于统计）
}

// ===== 场景包数据定义 =====

export const SCENE_PACKS: ScenePack[] = [
  {
    id: 'portrait-photography',
    name: '人像摄影',
    nameEn: 'Portrait Photography',
    icon: '👤',
    category: 'portrait',
    preview: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop',
    description: '专业人像照片，85mm镜头，浅景深，工作室灯光',
    difficulty: 'beginner',
    tags: {
      artStyle: 'photorealistic',
      mood: 'warm-bright',
      technical: ['85mm-lens', 'shallow-dof', 'studio-lighting'],
      enhancement: ['highly-detailed', 'professional']
    },
    recommendedModel: 'flux-dev',
    recommendedAspectRatio: '3:4',
    recommendedSteps: 28,
    examples: [
      '商务人士的职业照片',
      '优雅女性肖像',
      '阳光男性形象照'
    ],
    tips: '适合创作头像、简历照、社交媒体形象照'
  },

  {
    id: 'landscape-epic',
    name: '风景大片',
    nameEn: 'Epic Landscape',
    icon: '🏔️',
    category: 'landscape',
    preview: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=450&fit=crop',
    description: '壮丽自然风光，广角镜头，黄金时刻，电影级质感',
    difficulty: 'beginner',
    tags: {
      artStyle: 'cinematic',
      themeStyle: 'nature',
      mood: 'epic',
      technical: ['wide-angle', 'golden-hour'],
      composition: ['rule-of-thirds', 'dynamic'],
      enhancement: ['highly-detailed', 'hdr', 'cinematic-quality']
    },
    recommendedModel: 'flux-schnell',
    recommendedAspectRatio: '16:9',
    recommendedSteps: 4,
    examples: [
      '雪山日落壮景',
      '森林晨雾仙境',
      '海边惊涛骇浪'
    ],
    tips: '适合创作桌面壁纸、旅游风光、自然摄影'
  },

  {
    id: 'chinese-style-art',
    name: '国风插画',
    nameEn: 'Chinese Art',
    icon: '🎨',
    category: 'art',
    preview: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=450&fit=crop',
    description: '中国传统艺术风格，水墨质感，诗意氛围',
    difficulty: 'intermediate',
    tags: {
      artStyle: 'watercolor',
      themeStyle: 'chinese-style',
      mood: 'dreamy',
      composition: ['centered'],
      enhancement: ['masterpiece', 'highly-detailed']
    },
    recommendedModel: 'flux-dev',
    recommendedAspectRatio: '3:4',
    recommendedSteps: 28,
    examples: [
      '古装美人画像',
      '山水意境画',
      '水墨花鸟图'
    ],
    tips: '适合创作国风插画、传统艺术作品'
  },

  {
    id: 'cyberpunk-neon',
    name: '赛博朋克',
    nameEn: 'Cyberpunk',
    icon: '🤖',
    category: 'art',
    preview: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?w=800&h=450&fit=crop',
    description: '未来科技感，霓虹灯效果，戏剧性灯光',
    difficulty: 'intermediate',
    tags: {
      artStyle: 'cinematic',
      themeStyle: 'cyberpunk',
      mood: 'futuristic-tech',
      technical: ['blue-hour'],
      composition: ['dynamic'],
      enhancement: ['highly-detailed', 'color-grading', 'bloom']
    },
    recommendedModel: 'flux-schnell',
    recommendedAspectRatio: '16:9',
    recommendedSteps: 4,
    examples: [
      '未来都市夜景',
      '赛博女战士',
      '霓虹街道场景'
    ],
    tips: '适合创作科幻场景、游戏概念图'
  },

  {
    id: 'product-commercial',
    name: '产品摄影',
    nameEn: 'Product Photography',
    icon: '📦',
    category: 'product',
    preview: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=450&fit=crop',
    description: '商业产品摄影，白色背景，专业灯光',
    difficulty: 'beginner',
    tags: {
      artStyle: 'photorealistic',
      technical: ['macro', 'studio-lighting'],
      composition: ['centered', 'minimalist'],
      enhancement: ['highly-detailed', 'professional']
    },
    recommendedModel: 'flux-dev',
    recommendedAspectRatio: '1:1',
    recommendedSteps: 28,
    examples: [
      '电子产品特写',
      '美妆产品展示',
      '食品摄影'
    ],
    tips: '适合电商产品图、广告素材'
  },

  {
    id: 'anime-character',
    name: '动漫角色',
    nameEn: 'Anime Character',
    icon: '🎭',
    category: 'art',
    preview: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&h=450&fit=crop',
    description: '日系动漫风格，明亮色彩，动态构图',
    difficulty: 'intermediate',
    tags: {
      artStyle: 'anime',
      mood: 'energetic',
      composition: ['dynamic', 'close-up'],
      enhancement: ['highly-detailed', 'color-grading']
    },
    recommendedModel: 'flux-schnell',
    recommendedAspectRatio: '3:4',
    recommendedSteps: 4,
    examples: [
      '少女角色立绘',
      '战斗场景',
      '日常生活场景'
    ],
    tips: '适合动漫角色设计、游戏立绘'
  },

  {
    id: 'oil-painting-classic',
    name: '古典油画',
    nameEn: 'Classical Oil Painting',
    icon: '🖼️',
    category: 'art',
    preview: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&h=450&fit=crop',
    description: '欧洲古典油画风格，厚重质感，温暖色调',
    difficulty: 'advanced',
    tags: {
      artStyle: 'oil-painting',
      mood: 'luxurious',
      composition: ['centered'],
      enhancement: ['masterpiece', 'highly-detailed']
    },
    recommendedModel: 'flux-dev',
    recommendedAspectRatio: '4:3',
    recommendedSteps: 28,
    examples: [
      '贵族肖像',
      '静物写生',
      '宗教题材'
    ],
    tips: '适合艺术创作、古典风格作品'
  },

  {
    id: 'modern-minimalist',
    name: '现代简约',
    nameEn: 'Modern Minimalist',
    icon: '⚪',
    category: 'design',
    preview: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=800&h=450&fit=crop',
    description: '现代简约风格，干净利落，留白设计',
    difficulty: 'beginner',
    tags: {
      artStyle: 'concept-art',
      themeStyle: 'modern',
      mood: 'peaceful',
      composition: ['minimalist', 'centered'],
      enhancement: ['professional']
    },
    recommendedModel: 'flux-schnell',
    recommendedAspectRatio: '16:9',
    recommendedSteps: 4,
    examples: [
      '建筑空间',
      '产品设计',
      '抽象艺术'
    ],
    tips: '适合现代设计、品牌视觉'
  }
];

// ===== 辅助函数 =====

/**
 * 根据 ID 获取场景包
 */
export function getScenePackById(id: string): ScenePack | undefined {
  return SCENE_PACKS.find(pack => pack.id === id);
}

/**
 * 根据分类获取场景包
 */
export function getScenePacksByCategory(category: ScenePack['category']): ScenePack[] {
  return SCENE_PACKS.filter(pack => pack.category === category);
}

/**
 * 根据难度获取场景包
 */
export function getScenePacksByDifficulty(difficulty: ScenePack['difficulty']): ScenePack[] {
  return SCENE_PACKS.filter(pack => pack.difficulty === difficulty);
}

/**
 * 获取推荐的场景包（新手友好）
 */
export function getRecommendedScenePacks(): ScenePack[] {
  return SCENE_PACKS.filter(pack => pack.difficulty === 'beginner');
}

/**
 * 获取按使用次数排序的场景包
 */
export function getPopularScenePacks(): ScenePack[] {
  return [...SCENE_PACKS].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
}
