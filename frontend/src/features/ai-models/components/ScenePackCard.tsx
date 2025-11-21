/**
 * 场景包卡片组件
 * 用于展示和选择场景包
 */

import React from 'react';
import type { ScenePack } from '@/constants/scenePacks';

interface ScenePackCardProps {
  pack: ScenePack;
  isSelected: boolean;
  onSelect: () => void;
}

export function ScenePackCard({ pack, isSelected, onSelect }: ScenePackCardProps) {
  return (
    <div
      className={`
        scene-pack-card cursor-pointer rounded-lg overflow-hidden
        border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1
        ${isSelected
          ? 'border-primary-500 shadow-md ring-4 ring-primary-100'
          : 'border-gray-200 hover:border-gray-300'
        }
      `}
      onClick={onSelect}
    >
      {/* 预览图区域 */}
      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {/* 临时占位图 - 后续替换为真实预览图 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-30">{pack.icon}</span>
        </div>

        <img
          src={pack.preview}
          alt={pack.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // 图片加载失败时隐藏
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* 难度标签 */}
        <div className="absolute top-2 right-2">
          <span className={`
            px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm
            ${pack.difficulty === 'beginner' ? 'bg-green-100/90 text-green-700' : ''}
            ${pack.difficulty === 'intermediate' ? 'bg-yellow-100/90 text-yellow-700' : ''}
            ${pack.difficulty === 'advanced' ? 'bg-red-100/90 text-red-700' : ''}
          `}>
            {pack.difficulty === 'beginner' && '新手'}
            {pack.difficulty === 'intermediate' && '进阶'}
            {pack.difficulty === 'advanced' && '专业'}
          </span>
        </div>

        {/* 选中指示器 */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary-500 bg-opacity-20 flex items-center justify-center">
            <div className="bg-white rounded-full p-2 shadow-lg">
              <svg
                className="w-6 h-6 text-primary-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 信息区域 */}
      <div className="p-4">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{pack.icon}</span>
          <div>
            <h4 className="font-semibold text-gray-900">{pack.name}</h4>
            <p className="text-xs text-gray-500">{pack.nameEn}</p>
          </div>
        </div>

        {/* 描述 */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {pack.description}
        </p>

        {/* 标签预览 */}
        <div className="flex flex-wrap gap-1">
          {pack.tags.artStyle && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
              {getTagDisplayName(pack.tags.artStyle, 'artStyle')}
            </span>
          )}
          {pack.tags.mood && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
              {getTagDisplayName(pack.tags.mood, 'mood')}
            </span>
          )}
          {pack.tags.technical?.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded"
            >
              {getTagDisplayName(tag, 'technical')}
            </span>
          ))}
          {pack.tags.technical && pack.tags.technical.length > 2 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              +{pack.tags.technical.length - 2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 获取标签的显示名称
 * 将英文标签 ID 转换为中文显示名
 */
function getTagDisplayName(tagId: string, category: string): string {
  // 标签 ID 到中文名的映射
  const tagNameMap: Record<string, string> = {
    // 艺术风格
    'photorealistic': '照片级',
    'cinematic': '电影感',
    'oil-painting': '油画',
    'watercolor': '水彩',
    'anime': '动漫',
    'pixel-art': '像素',
    'sketch': '素描',
    'concept-art': '概念艺术',
    '3d-render': '3D渲染',
    'impressionist': '印象派',

    // 主题风格
    'cyberpunk': '赛博朋克',
    'sci-fi': '科幻',
    'fantasy': '奇幻',
    'steampunk': '蒸汽朋克',
    'chinese-style': '国风',
    'modern': '现代',
    'retro-futurism': '复古未来',
    'nature': '自然',
    'industrial': '工业',
    'gothic': '哥特',

    // 情绪氛围
    'warm-bright': '温暖明亮',
    'dark-mysterious': '神秘黑暗',
    'dreamy': '梦幻',
    'epic': '史诗',
    'peaceful': '平和',
    'energetic': '活力',
    'melancholic': '忧郁',
    'luxurious': '奢华',
    'wild': '狂野',
    'futuristic-tech': '科技未来',

    // 技术参数
    '85mm-lens': '85mm',
    'wide-angle': '广角',
    'macro': '微距',
    'telephoto': '长焦',
    'fisheye': '鱼眼',
    'shallow-dof': '浅景深',
    'deep-focus': '大景深',
    'golden-hour': '黄金时刻',
    'blue-hour': '蓝调时刻',
    'studio-lighting': '工作室光',

    // 构图参数
    'rule-of-thirds': '三分法',
    'centered': '居中',
    'low-angle': '低角度',
    'high-angle': '高角度',
    'close-up': '特写',
    'wide-shot': '全景',
    'medium-shot': '中景',
    'extreme-close-up': '大特写',
    'dynamic': '动态',
    'minimalist': '极简',

    // 增强效果
    'highly-detailed': '高细节',
    'cinematic-quality': '电影级',
    'professional': '专业',
    'masterpiece': '大师作品',
    'volumetric-lighting': '体积光',
    'color-grading': '调色',
    'hdr': 'HDR',
    'film-grain': '胶片颗粒',
    'bokeh': '散景',
    'bloom': '光晕'
  };

  return tagNameMap[tagId] || tagId;
}
