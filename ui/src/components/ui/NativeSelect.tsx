import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface NativeSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void | Promise<void>;
  /** Small caption above the control (`field`) or before it (`inline`). */
  label?: string;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  disabled?: boolean;
  /**
   * `field`: a full-width bordered control.
   * `inline`: link-styled, sized to its current option, for "Cab: Mesa ▾"
   * lines. Both are the same native `<select>` underneath.
   */
  variant?: 'field' | 'inline';
  className?: string;
}

/**
 * A styled native `<select>`. The popup is drawn by the OS, so it escapes
 * iframe bounds and needs no outside-click, keyboard, or portal handling.
 */
export const NativeSelect: React.FC<NativeSelectProps> = ({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  variant = 'field',
  className = '',
}) => {
  const id = useId();
  const hasValue = options.some(o => o.value === value);
  const current = hasValue ? value : (options[0]?.value ?? '');
  const currentLabel = options.find(o => o.value === current)?.label ?? '';

  const select = (extra: string) => (
    <select
      id={id}
      className={extra}
      value={current}
      onChange={e => void onChange(e.target.value)}
      disabled={disabled}
      aria-label={!label ? ariaLabel : undefined}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (variant === 'inline') {
    // The visible text sizes the control; the real <select> sits on top of
    // it, transparent, so clicks and keyboard focus land on the native one.
    return (
      <span
        className={`inline-flex items-baseline gap-1 min-w-0 max-w-full ${className}`}
      >
        {label && (
          <label htmlFor={id} className='text-muted flex-shrink-0'>
            {label}
          </label>
        )}
        <span
          className={`relative inline-flex items-center gap-0.5 min-w-0 rounded-sm focus-within:ring-2 focus-within:ring-fg ${
            disabled
              ? 'text-muted cursor-not-allowed'
              : 'text-link cursor-pointer'
          }`}
        >
          <span className='truncate font-medium'>{currentLabel}</span>
          <ChevronDown size={14} aria-hidden='true' className='flex-shrink-0' />
          {select(
            't3k-select absolute inset-0 w-full h-full opacity-0 cursor-[inherit]'
          )}
        </span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <label htmlFor={id} className='text-sm text-muted pb-1'>
          {label}
        </label>
      )}
      <div className='relative'>
        {select(
          `t3k-select w-full px-4 py-3 pr-11 text-md text-fg border border-line rounded-md focus:outline-none focus-visible:border-fg truncate ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`
        )}
        <ChevronDown
          size={24}
          aria-hidden='true'
          className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg'
        />
      </div>
    </div>
  );
};
