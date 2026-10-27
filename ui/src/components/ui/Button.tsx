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
  primary: 'bg-accent text-accent-fg border border-accent',
  secondary: 'bg-transparent text-fg border border-fg',
  ghost: 'bg-transparent text-link border border-transparent hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
};

/** Pill button. `primary` is filled with the accent, `secondary` outlined. */
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
    className={`inline-flex items-center justify-center gap-2 font-semibold rounded-full whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
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
