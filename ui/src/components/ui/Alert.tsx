import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

type AlertVariant = 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { text: string; Icon: typeof Info }> =
  {
    error: { text: 'text-danger', Icon: AlertTriangle },
    warning: { text: 'text-warning', Icon: AlertCircle },
    info: { text: 'text-muted', Icon: Info },
  };

/** One-line status message with a leading icon. Colors come from the tokens. */
export const Alert: React.FC<AlertProps> = ({
  variant,
  children,
  className = '',
}) => {
  const { text, Icon } = variantStyles[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 text-sm ${text} ${className}`}
    >
      <Icon size={18} className='flex-shrink-0 mt-0.5' aria-hidden='true' />
      <div className='flex flex-col gap-1 min-w-0'>{children}</div>
    </div>
  );
};
