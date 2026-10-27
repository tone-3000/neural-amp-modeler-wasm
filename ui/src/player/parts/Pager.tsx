import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagerProps {
  index: number;
  count: number;
  onStep: (delta: 1 | -1) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

const ArrowButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, label, children }) => (
  <button
    type='button'
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className='flex items-center justify-center w-7 h-7 -mx-1 rounded text-muted-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-2'
  >
    {children}
  </button>
);

/** ‹ n/N › — steps the active tone of a playlist. */
export const Pager: React.FC<PagerProps> = ({
  index,
  count,
  onStep,
  disabled = false,
  className = '',
}) => (
  <div
    className={`flex items-center gap-1 flex-shrink-0 ${className}`}
    role='group'
    aria-label='Tones'
  >
    <ArrowButton
      onClick={() => void onStep(-1)}
      disabled={disabled || index <= 0}
      label='Previous tone'
    >
      <ChevronLeft size={20} />
    </ArrowButton>
    <span
      className='text-sm text-muted-2 tabular-nums min-w-[3ch] text-center'
      aria-live='polite'
    >
      {index + 1}/{count}
    </span>
    <ArrowButton
      onClick={() => void onStep(1)}
      disabled={disabled || index >= count - 1}
      label='Next tone'
    >
      <ChevronRight size={20} />
    </ArrowButton>
  </div>
);
