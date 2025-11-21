import React, { useState } from 'react';
import { Settings, Wand2, Sliders } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { PromptInput } from './PromptInput';
import { GenerationModeSelector } from './GenerationModeSelector';

interface SettingsTabsProps {
  initialPrompt?: string;
  disabled?: boolean;
  suggestedTags?: any;
  parsedFeatures?: any; // 新增：解析出的特征信息
}

type TabId = 'model' | 'prompt' | 'advanced';

const tabs = [
  { id: 'model' as TabId, label: '模型配置', icon: Settings },
  { id: 'prompt' as TabId, label: '提示词', icon: Wand2 },
  { id: 'advanced' as TabId, label: '高级选项', icon: Sliders },
];

export function SettingsTabs({ initialPrompt = '', disabled = false, suggestedTags, parsedFeatures }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('model');

  return (
    <div className="flex flex-col h-full">
      {/* 标签页导航 */}
      <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 标签页内容 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'model' && (
          <div className="p-6">
            <ModelSelector disabled={disabled} compact={true} />
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="p-6">
            {/* 使用新的场景包模式选择器 */}
            <GenerationModeSelector
              initialPrompt={initialPrompt}
              disabled={disabled}
            />
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="p-6">
            <AdvancedSettings disabled={disabled} />
          </div>
        )}
      </div>
    </div>
  );
}

// 高级设置组件
function AdvancedSettings({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <Sliders className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">高级选项</h3>
        <p className="text-sm text-gray-600">
          更多高级配置功能即将推出
        </p>
      </div>

      {/* 可以在这里添加更多高级选项 */}
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">💡 使用技巧</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 选择合适的模型可以大幅提升生成质量</li>
            <li>• 详细的提示词描述能产生更好的结果</li>
            <li>• 适当的宽高比选择很重要</li>
            <li>• 推理步数越多质量越好，但耗时更长</li>
          </ul>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-900 mb-2">⚠️ 注意事项</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• 每日免费使用次数有限</li>
            <li>• 避免使用违规内容的提示词</li>
            <li>• 生成时间通常为20-60秒</li>
            <li>• 网络不稳定可能导致生成失败</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 