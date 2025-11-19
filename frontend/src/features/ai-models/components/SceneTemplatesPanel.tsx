/**
 * 场景模板面板组件
 * 提供预设的专业场景模板供用户选择
 */

import React from 'react';

interface SceneTemplate {
  label: string;
  prompt: string;
  technical: string;
  lighting: string;
  mood: string;
}

interface SceneTemplatesPanelProps {
  templates: SceneTemplate[];
  selectedTemplate: string;
  onSelect: (template: SceneTemplate) => void;
}

export function SceneTemplatesPanel({
  templates,
  selectedTemplate,
  onSelect,
}: SceneTemplatesPanelProps) {
  return (
    <div className="p-4 bg-violet-50/70 backdrop-blur-sm rounded-xl border border-violet-200">
      <h4 className="font-medium text-gray-800 mb-3">📸 专业场景模板</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((template, index) => (
          <div
            key={index}
            onClick={() => onSelect(template)}
            className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
              selectedTemplate === template.label
                ? 'border-violet-500 bg-violet-100'
                : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50'
            }`}
          >
            <div className="font-medium text-gray-800 mb-1">{template.label}</div>
            <div className="text-xs text-gray-600 mb-2">{template.prompt}</div>
            <div className="text-xs text-violet-600">
              {template.technical} • {template.lighting}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
