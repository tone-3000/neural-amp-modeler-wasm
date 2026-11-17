import React from 'react';
import { Logo } from '../../components/ui/Logo';
import { LogoSm } from '../../components/ui/LogoSm';

/**
 * The TONE3000 attribution: the wordmark, stepping down to the T3K mark as
 * the tab bar narrows (container queries in index.css). Both are in the DOM;
 * CSS picks one. "Powered by" is not shown: it is the link's accessible
 * name, for screen readers only.
 */
export const PoweredBy: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <a
    href='https://www.tone3000.com'
    target='_blank'
    rel='noopener noreferrer'
    aria-label='Powered by TONE3000'
    className={`t3k-powered flex flex-row items-center flex-shrink-0 ${className}`}
  >
    <Logo height={16} className='t3k-powered-logo' />
    <LogoSm width={42} height={14} className='t3k-powered-mark' />
  </a>
);
