import React from 'react';
import { LogoSm } from '../../components/ui/LogoSm';

export const PoweredBy: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <a
    href='https://www.tone3000.com'
    target='_blank'
    rel='noopener noreferrer'
    className={`flex flex-row gap-2 items-center flex-shrink-0 ${className}`}
  >
    {/* `.t3k-powered-text` goes sr-only when the tab bar is too narrow. */}
    <span className='t3k-powered-text text-muted text-xs'>Powered by</span>
    <LogoSm width={42} height={14} />
  </a>
);
