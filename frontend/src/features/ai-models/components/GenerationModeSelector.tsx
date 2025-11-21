/**
 * 生成模式选择器
 * 提供三种模式：快速模式、自定义风格、专业模式
 */

import React, { useState } from 'react';
import { QuickModePanel } from './QuickModePanel';
import { PromptInput } from './PromptInput';
import type { GenerationConfig } from '../../../types';

export type GenerationMode = 'quick' | 'custom' | 'advanced';

interface GenerationModeSelectorProps {
  onGenerate?: (config: GenerationConfig) => void;
  disabled?: boolean;
  initialPrompt?: string;
}

export function GenerationModeSelector({
  onGenerate,
  disabled = false,
  initialPrompt = ''
}: GenerationModeSelectorProps) {
  const [mode, setMode] = useState<GenerationMode>('quick');

  return (
    <div className="generation-mode-selector">
      {/* Tab 切换栏 */}
      <div className="mode-tabs flex gap-2 mb-6 border-b border-gray-200">
        <TabButton
          active={mode === 'quick'}
          onClick={() => setMode('quick')}
          icon="⚡"
          label="快速生成"
          badge="推荐"
          badgeColor="green"
        />

        <TabButton
          active={mode === 'custom'}
          onClick={() => setMode('custom')}
          icon="🎨"
          label="自定义风格"
          badge="即将上线"
          badgeColor="blue"
        />

        <TabButton
          active={mode === 'advanced'}
          onClick={() => setMode('advanced')}
          icon="🔧"
          label="专业模式"
        />
      </div>

      {/* 内容区域 */}
      <div className="mode-content">
        {mode === 'quick' && (
          <QuickModePanel />
        )}

        {mode === 'custom' && (
          <CustomStylePanel />
        )}

        {mode === 'advanced' && (
          <AdvancedPanel
            onGenerate={onGenerate}
            disabled={disabled}
            initialPrompt={initialPrompt}
          />
        )}
      </div>

      {/* 底部帮助提示 */}
      <ModeHelpText mode={mode} />
    </div>
  );
}

// ===== 子组件 =====

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'yellow';
}

function TabButton({ active, onClick, icon, label, badge, badgeColor = 'green' }: TabButtonProps) {
  const badgeColors = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <button
      className={`
        px-4 py-3 font-medium transition-all duration-200 relative
        border-b-2 -mb-px
        ${active
          ? 'text-primary-600 border-primary-600'
          : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
        }
      `}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * 自定义风格面板（即将实现）
 */
function CustomStylePanel() {
  return (
    <div className="custom-style-panel">
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🎨</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          自定义风格模式
        </h3>
        <p className="text-gray-600 mb-6">
          可视化风格预设选择，即将上线
        </p>
        <div className="max-w-md mx-auto text-left bg-gray-50 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-3">即将推出的功能：</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>艺术风格预设</strong> - 照片、电影、油画、动漫等可视化选择</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>色彩氛围预设</strong> - 温暖、冷调、梦幻等色调选择</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>构图预设</strong> - 特写、中景、全景等构图方式</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>灯光预设</strong> - 工作室、自然光、黄金时刻等</span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            敬请期待，或先使用"快速生成"或"专业模式"
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 专业模式面板（使用现有的 PromptInput 组件）
 */
function AdvancedPanel({
  onGenerate,
  disabled,
  initialPrompt
}: {
  onGenerate?: (config: GenerationConfig) => void;
  disabled: boolean;
  initialPrompt: string;
}) {
  return (
    <div className="advanced-panel">
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h4 className="font-medium text-amber-900 mb-1">专业模式</h4>
            <p className="text-sm text-amber-700">
              此模式提供完整的标签和参数控制，适合有经验的用户。
              如果你是新手，推荐使用<strong>"快速生成"</strong>模式。
            </p>
          </div>
        </div>
      </div>

      {/* 使用现有的 PromptInput 组件 */}
      <PromptInput
        onGenerate={onGenerate}
        disabled={disabled}
        initialPrompt={initialPrompt}
      />
    </div>
  );
}

/**
 * 模式帮助文本
 */
function ModeHelpText({ mode }: { mode: GenerationMode }) {
  const helpTexts = {
    quick: {
      icon: '💡',
      title: '快速模式',
      description: '适合新手，选择一个场景包即可开始创作，系统会自动配置最佳参数。',
    },
    custom: {
      icon: '💡',
      title: '自定义风格',
      description: '通过可视化预设选择风格、色彩、构图和灯光，更灵活的创作控制。',
    },
    advanced: {
      icon: '💡',
      title: '专业模式',
      description: '完整的标签和参数控制，适合有经验的用户进行精细调整。',
    },
  };

  const help = helpTexts[mode];

  return (
    <div className="mode-help mt-6 p-4 bg-gray-50 rounded-lg text-sm">
      <div className="flex items-start gap-2">
        <span className="text-lg">{help.icon}</span>
        <div>
          <span className="font-medium text-gray-900">{help.title}：</span>
          <span className="text-gray-600">{help.description}</span>
        </div>
      </div>
    </div>
  );
}
