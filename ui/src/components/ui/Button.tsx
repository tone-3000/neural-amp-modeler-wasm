import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 't3k-btn-primary border border-transparent',
  secondary: 'bg-transparent text-fg border border-fg',
  ghost: 'bg-transparent text-link border border-transparent hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
};

/**
 * Pill button. `primary` is filled with `--t3k-primary` (the TONE3000
 * blue), `secondary` outlined. `fullWidth` fills its container; callers
 * cap the container (or pass `max-w-*` in `className`) so a wide panel
 * doesn't get a panel-wide pill.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  leftIcon,
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`items-center justify-center gap-2 font-semibold rounded-full whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'flex w-full' : 'inline-flex'} ${className}`}
    {...props}
  >
    {leftIcon && (
      <span className='flex-shrink-0' aria-hidden='true'>
        {leftIcon}
      </span>
    )}
    {children}
  </button>
);
