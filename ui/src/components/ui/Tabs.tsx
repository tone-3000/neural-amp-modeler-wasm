import React, { ReactNode } from 'react';

interface TabProps {
  tabs: (string | ReactNode)[];
  activeTab: number;
  setActiveTab: (index: number) => void;
  disabled?: boolean;
  /** Stretch tabs across the container (default) or size them to content. */
  fill?: boolean;
}

const Tabs = ({
  tabs,
  activeTab,
  setActiveTab,
  disabled = false,
  fill = true,
}: TabProps) => {
  return (
    <div
      className={`flex ${fill ? 'w-full' : 'gap-2 sm:gap-4'}`}
      role='tablist'
    >
      {tabs.map((tab, index) => {
        const active = index === activeTab;
        return (
          <button
            key={index}
            type='button'
            role='tab'
            aria-selected={active}
            disabled={disabled}
            className={`flex justify-center py-2 font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 disabled:cursor-not-allowed ${
              fill ? 'flex-1 px-4' : 'px-1'
            } ${
              active
                ? 'text-fg border-fg'
                : 'text-muted border-transparent hover:text-fg'
            }`}
            onClick={() => setActiveTab(index)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
};

export { Tabs };
