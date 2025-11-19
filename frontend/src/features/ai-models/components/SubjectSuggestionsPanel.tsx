/**
 * 主题建议面板组件
 * 提供预设的主题建议供用户快速选择
 */

import React from 'react';

interface SubjectSuggestionsPanelProps {
  suggestions: string[];
  onSelect: (subject: string) => void;
}

export function SubjectSuggestionsPanel({
  suggestions,
  onSelect,
}: SubjectSuggestionsPanelProps) {
  return (
    <div className="p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200">
      <h4 className="font-medium text-gray-800 mb-3">💡 主题建议</h4>
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((subject, index) => (
          <button
            key={index}
            onClick={() => onSelect(subject)}
            className="text-left p-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {subject}
          </button>
        ))}
      </div>
    </div>
  );
}
