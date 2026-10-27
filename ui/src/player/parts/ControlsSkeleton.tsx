import React from 'react';

const Bar: React.FC<{ className: string }> = ({ className }) => (
  <span className={`t3k-skeleton block rounded ${className}`} />
);

/**
 * Placeholder for `Controls` while a lazy tone resolves. Mirrors its
 * structure and spacing exactly (same wrappers, the field select's padding
 * and type size, the toggle's box) so swapping it for the real controls
 * doesn't move anything — important for embeds, where every height change
 * is a frame resize.
 */
export const ControlsSkeleton: React.FC = () => (
  <div className='flex flex-col gap-3' role='status' aria-label='Loading tone'>
    <div className='flex flex-col gap-1'>
      {/* Caption row: "<primary label>" … "Tone on" */}
      <div className='flex items-center justify-between text-sm'>
        <span className='flex items-center h-5'>
          <Bar className='h-3 w-24' />
        </span>
        <span className='flex items-center justify-center h-5 w-10 flex-shrink-0'>
          <Bar className='h-3 w-14' />
        </span>
      </div>
      {/* Field select + toggle */}
      <div className='flex items-center gap-4'>
        <div className='relative flex-1 min-w-0 px-4 py-3 text-md border border-line rounded-md'>
          {/* Invisible glyph keeps the select's exact line box. */}
          <span className='invisible'>·</span>
          <Bar className='absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-2/3' />
        </div>
        <span className='w-10 h-6 rounded-full bg-toggle-off opacity-50 flex-shrink-0' />
      </div>
    </div>
    {/* Inline row: "Input: …  Cab: …" — same `.t3k-inline-row` as the real
        one, so it stacks at the same width. */}
    <div className='t3k-inline-row flex flex-nowrap items-center gap-x-5 gap-y-1 text-sm min-w-0'>
      <span className='flex items-center h-5 min-w-0'>
        <Bar className='h-3 w-36' />
      </span>
      <span className='flex items-center h-5 min-w-0'>
        <Bar className='h-3 w-32' />
      </span>
    </div>
  </div>
);
