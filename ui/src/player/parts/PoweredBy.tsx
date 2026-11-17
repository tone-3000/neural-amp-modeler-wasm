import React from 'react';
import { Logo } from '../../components/ui/Logo';
import { LogoSm } from '../../components/ui/LogoSm';

const ATTRIBUTION_HREF = 'https://www.tone3000.com';

interface PoweredByProps {
  /** Where the logo links to. Defaults to tone3000.com. */
  href?: string;
  onClick?: (href: string) => void;
  className?: string;
}

/**
 * The TONE3000 attribution: the wordmark, stepping down to the T3K mark as
 * the tab bar narrows (container queries in index.css). Both are in the DOM;
 * CSS picks one. "Powered by" is not shown: it is the link's accessible
 * name, for screen readers only.
 */
export const PoweredBy: React.FC<PoweredByProps> = ({
  href = ATTRIBUTION_HREF,
  onClick,
  className = '',
}) => (
  <a
    href={href}
    target='_blank'
    rel='noopener'
    aria-label='Powered by TONE3000'
    onClick={() => onClick?.(href)}
    className={`t3k-powered flex flex-row items-center flex-shrink-0 ${className}`}
  >
    <Logo height={16} className='t3k-powered-logo' />
    <LogoSm width={42} height={14} className='t3k-powered-mark' />
  </a>
);
