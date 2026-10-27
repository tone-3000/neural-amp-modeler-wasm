import React from 'react';

/**
 * The NAM / IR format label, as on tone3000 tone cards and tone pages
 * (`components/ui/Tones/FormatPill.tsx` there): mono caps on a muted block.
 */
export const FormatPill: React.FC<{ format?: string | null }> = ({
  format,
}) => {
  if (!format) return null;
  return (
    <span className='bg-muted text-canvas text-xs font-mono px-[6px] py-[1px] rounded-sm whitespace-nowrap leading-4 flex-shrink-0'>
      {format.toUpperCase()}
    </span>
  );
};
