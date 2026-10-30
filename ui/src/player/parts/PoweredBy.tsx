import React from 'react';
import { Logo } from '../../components/ui/Logo';
import { LogoSm } from '../../components/ui/LogoSm';

/**
 * "Powered by TONE3000", stepping down as the tab bar narrows (container
 * queries in index.css): words + wordmark → wordmark → T3K mark. All three
 * are in the DOM; CSS picks one, so the link's accessible name stays put.
 */
export const PoweredBy: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <a
    href='https://www.tone3000.com'
    target='_blank'
    rel='noopener noreferrer'
    aria-label='Powered by TONE3000'
    className={`t3k-powered flex flex-row gap-2 items-center flex-shrink-0 ${className}`}
  >
    <span className='t3k-powered-text text-muted text-xs' aria-hidden='true'>
      Powered by
    </span>
    <Logo height={16} className='t3k-powered-logo' />
    <LogoSm width={42} height={14} className='t3k-powered-mark' />
  </a>
);
