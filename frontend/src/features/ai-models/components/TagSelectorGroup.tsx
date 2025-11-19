import React from 'react';

interface Tag {
  label: string;
  value: string;
}

interface TagSelectorGroupProps {
  title: string;
  icon: string;
  tags: Tag[];
  selectedValue: string | string[];  // 单选为 string，多选为 string[]
  onSelect: (value: string) => void;
  isMultiple?: boolean;
  compact?: boolean;
  colorScheme?: 'blue' | 'purple' | 'orange' | 'indigo' | 'teal' | 'green';
}

const colorSchemes = {
  blue: {
    selected: 'bg-blue-500 text-white',
    indicator: 'text-blue-600',
  },
  purple: {
    selected: 'bg-purple-500 text-white',
    indicator: 'text-purple-600',
  },
  orange: {
    selected: 'bg-orange-500 text-white',
    indicator: 'text-orange-600',
  },
  indigo: {
    selected: 'bg-indigo-500 text-white',
    indicator: 'text-indigo-600',
  },
  teal: {
    selected: 'bg-teal-500 text-white',
    indicator: 'text-teal-600',
  },
  green: {
    selected: 'bg-green-500 text-white',
    indicator: 'text-green-600',
  },
};

export function TagSelectorGroup({
  title,
  icon,
  tags,
  selectedValue,
  onSelect,
  isMultiple = false,
  compact = false,
  colorScheme = 'blue',
}: TagSelectorGroupProps) {
  const colors = colorSchemes[colorScheme];

  // 判断标签是否被选中
  const isSelected = (value: string): boolean => {
    if (isMultiple) {
      return Array.isArray(selectedValue) && selectedValue.includes(value);
    }
    return selectedValue === value;
  };

  // 获取已选择数量
  const getSelectedCount = (): number => {
    if (isMultiple && Array.isArray(selectedValue)) {
      return selectedValue.length;
    }
    return selectedValue ? 1 : 0;
  };

  const hasSelection = isMultiple
    ? Array.isArray(selectedValue) && selectedValue.length > 0
    : Boolean(selectedValue);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between">
        <h4 className={`font-medium text-gray-800 ${compact ? "text-sm" : ""}`}>
          {icon} {title} <span className="text-xs text-gray-500">({isMultiple ? '可多选' : '单选'})</span>
        </h4>
        {hasSelection && (
          <span className={`text-xs ${colors.indicator}`}>
            {isMultiple ? `已选择 ${getSelectedCount()} 个` : '已选择'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <button
            key={index}
            onClick={() => onSelect(tag.value)}
            className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm"} rounded-lg transition-colors ${
              isSelected(tag.value)
                ? colors.selected
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
