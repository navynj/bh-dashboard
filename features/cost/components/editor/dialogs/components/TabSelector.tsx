/**
 * Tab Selector Component
 * Tab selector for switching between Product and Cost views
 */

interface TabSelectorProps {
  activeTab: 'product' | 'cost';
  onTabChange: (tab: 'product' | 'cost') => void;
  disabled?: boolean;
  showCostTab?: boolean;
  productLabel: string;
  costLabel: string;
}

export function TabSelector({
  activeTab,
  onTabChange,
  disabled = false,
  showCostTab = true,
  productLabel,
  costLabel,
}: TabSelectorProps) {
  if (!showCostTab) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4 border-b">
      <button
        onClick={() => !disabled && onTabChange('product')}
        disabled={disabled}
        className={`px-4 py-2 font-medium ${
          activeTab === 'product'
            ? 'border-b-2 border-primary'
            : 'text-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {productLabel}
      </button>
      <button
        onClick={() => !disabled && onTabChange('cost')}
        disabled={disabled}
        className={`px-4 py-2 font-medium ${
          activeTab === 'cost'
            ? 'border-b-2 border-primary'
            : 'text-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {costLabel}
      </button>
    </div>
  );
}

