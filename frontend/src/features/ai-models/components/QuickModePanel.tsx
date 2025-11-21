/**
 * 快速模式面板
 * 提供场景包选择，简化用户操作流程
 */

import React, { useState } from 'react';
import { SCENE_PACKS, type ScenePack } from '@/constants/scenePacks';
import { ScenePackCard } from './ScenePackCard';
import { useAIGenerationStore } from '@/store/aiGenerationStore';

interface QuickModePanelProps {
  onPackSelected?: (pack: ScenePack) => void;
  onPromptChange?: (prompt: string) => void; // 提示词变化回调
}

export function QuickModePanel({ onPackSelected, onPromptChange }: QuickModePanelProps) {
  const [selectedPack, setSelectedPack] = useState<ScenePack | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [quickPrompt, setQuickPrompt] = useState<string>(''); // 快速模式的提示词

  const { updateConfig } = useAIGenerationStore();

  // 处理场景包选择
  const handleSelectPack = (pack: ScenePack) => {
    setSelectedPack(pack);
    applyScenePack(pack);
    onPackSelected?.(pack);
    // 自动填充第一个示例作为默认提示词
    const defaultPrompt = pack.examples[0] || '';
    setQuickPrompt(defaultPrompt);
    onPromptChange?.(defaultPrompt);
  };

  // 处理提示词变化
  const handlePromptChange = (value: string) => {
    setQuickPrompt(value);
    onPromptChange?.(value); // 通知父组件
  };

  // 应用场景包配置
  const applyScenePack = (pack: ScenePack) => {
    // 1. 更新模型和基础配置
    updateConfig({
      model: pack.recommendedModel,
      aspectRatio: pack.recommendedAspectRatio,
      numInferenceSteps: pack.recommendedSteps || 4,
      // 保存场景包ID用于后续追踪
      scenePackId: pack.id,
      // 保存标签配置
      selectedTags: pack.tags,
    });

    // 2. 记录使用情况（用于统计和推荐）
    trackScenePackUsage(pack.id);

    console.log('✅ 场景包已应用:', pack.name, pack.tags);
  };

  // 追踪场景包使用
  const trackScenePackUsage = async (packId: string) => {
    try {
      // TODO: 保存到数据库或 analytics
      console.log('📊 场景包使用统计:', packId);
    } catch (error) {
      console.error('统计失败:', error);
    }
  };

  // 过滤场景包
  const filteredPacks = filterCategory === 'all'
    ? SCENE_PACKS
    : SCENE_PACKS.filter(pack => pack.category === filterCategory);

  // 分类选项
  const categories = [
    { id: 'all', name: '全部', icon: '🎯' },
    { id: 'portrait', name: '人像', icon: '👤' },
    { id: 'landscape', name: '风景', icon: '🏔️' },
    { id: 'art', name: '艺术', icon: '🎨' },
    { id: 'product', name: '产品', icon: '📦' },
    { id: 'design', name: '设计', icon: '✏️' },
  ];

  return (
    <div className="quick-mode-panel">
      {/* 顶部说明 */}
      <div className="panel-header mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              ⚡ 选择一个场景快速开始
            </h3>
            <p className="text-sm text-gray-600">
              无需选择复杂参数，一键生成专业效果
            </p>
          </div>

          {/* 新手提示 */}
          <div className="hidden md:block">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              💡 推荐新手使用
            </div>
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="category-filter mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setFilterCategory(category.id)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                whitespace-nowrap transition-all duration-200
                ${filterCategory === category.id
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 场景包网格 */}
      <div className="scene-pack-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPacks.map(pack => (
          <ScenePackCard
            key={pack.id}
            pack={pack}
            isSelected={selectedPack?.id === pack.id}
            onSelect={() => handleSelectPack(pack)}
          />
        ))}
      </div>

      {/* 无结果提示 */}
      {filteredPacks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">暂无该分类的场景包</p>
          <p className="text-sm mt-2">试试其他分类或使用全部场景</p>
        </div>
      )}

      {/* 选中场景包的详细信息 */}
      {selectedPack && (
        <div className="selected-pack-info mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">{selectedPack.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-gray-900 text-lg">
                  {selectedPack.name}
                </h4>
                <span className="text-sm text-gray-500">
                  ({selectedPack.nameEn})
                </span>
              </div>
              <p className="text-sm text-gray-600">{selectedPack.description}</p>
            </div>
          </div>

          {/* 配置信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg px-3 py-2 text-sm">
              <div className="text-gray-500 text-xs mb-1">推荐模型</div>
              <div className="font-medium text-gray-900">
                {selectedPack.recommendedModel}
              </div>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 text-sm">
              <div className="text-gray-500 text-xs mb-1">宽高比</div>
              <div className="font-medium text-gray-900">
                {selectedPack.recommendedAspectRatio}
              </div>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 text-sm">
              <div className="text-gray-500 text-xs mb-1">推荐步数</div>
              <div className="font-medium text-gray-900">
                {selectedPack.recommendedSteps || 4} 步
              </div>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 text-sm">
              <div className="text-gray-500 text-xs mb-1">难度</div>
              <div className={`font-medium ${
                selectedPack.difficulty === 'beginner' ? 'text-green-600' :
                selectedPack.difficulty === 'intermediate' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {selectedPack.difficulty === 'beginner' && '新手'}
                {selectedPack.difficulty === 'intermediate' && '进阶'}
                {selectedPack.difficulty === 'advanced' && '专业'}
              </div>
            </div>
          </div>

          {/* 示例提示 */}
          <div className="examples bg-white rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span>💡</span>
              <span>试试这些描述：</span>
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              {selectedPack.examples.map((example, i) => (
                <li
                  key={i}
                  className="pl-4 py-1 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  onClick={() => {
                    // 点击示例可以复制到剪贴板
                    navigator.clipboard.writeText(example);
                  }}
                  title="点击复制"
                >
                  • {example}
                </li>
              ))}
            </ul>

            {/* 使用提示 */}
            {selectedPack.tips && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">适用场景：</span>
                  {selectedPack.tips}
                </p>
              </div>
            )}
          </div>

          {/* 🔥 新增：提示词输入区 */}
          <div className="mt-6 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span>📝 描述你想要的内容</span>
                <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">
                  已自动填充示例
                </span>
              </label>
              <textarea
                value={quickPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder={`例如：${selectedPack.examples[0]}`}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none"
                rows={3}
              />
              <p className="mt-2 text-xs text-gray-500">
                💡 提示：已自动填充示例提示词，你可以直接生成或修改后生成
              </p>
            </div>
          </div>

          {/* 操作提示 */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>已自动配置所有参数，输入描述后点击底部的生成按钮即可</span>
          </div>
        </div>
      )}

      {/* 底部帮助 */}
      {!selectedPack && (
        <div className="help-section mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💭</div>
            <div className="flex-1">
              <h5 className="font-medium text-gray-900 mb-2">使用说明</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>1. 选择一个最符合你需求的场景包</li>
                <li>2. 在提示词输入框中描述具体内容（例如：一位微笑的女性）</li>
                <li>3. 点击生成按钮，系统会自动应用最佳参数</li>
                <li>4. 如需精细调整，可以切换到"自定义风格"或"专业模式"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
