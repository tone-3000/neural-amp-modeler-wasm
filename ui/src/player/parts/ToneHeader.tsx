import React from 'react';
import { ToneMeta } from '../../types';
import { Avatar } from '../../components/ui/Avatar';
import { FormatPill } from '../../components/ui/FormatPill';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';

interface ToneHeaderProps {
  meta: ToneMeta;
  /** `default` for the full layout, `dense` for compact playlists. */
  variant?: 'default' | 'dense';
  linkTarget?: '_blank' | '_self';
}

// Image sizes sit just under a two-line title plus the facts row (~72px /
// ~64px), so the thumbnail reads as the same block rather than an icon.
const SIZES = {
  default: { image: 68, title: 'text-base sm:text-lg', avatar: 20 },
  dense: { image: 56, title: 'text-sm sm:text-base', avatar: 18 },
} as const;

/**
 * Image, title, then one line of facts styled like a tone3000 tone card:
 * avatar name ✓ · subtitle (gear) · format pill.
 */
export const ToneHeader: React.FC<ToneHeaderProps> = ({
  meta,
  variant = 'default',
  linkTarget = '_blank',
}) => {
  const s = SIZES[variant];
  const rel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
  const { author } = meta;
  const hasFacts = !!(meta.subtitle || meta.format || author);

  const image = (
    <div
      className='rounded-t3k-sm flex-shrink-0 overflow-hidden bg-surface-2'
      style={{ width: s.image, height: s.image }}
    >
      {meta.imageUrl ? (
        <img
          src={meta.imageUrl}
          alt=''
          width={s.image}
          height={s.image}
          loading='lazy'
          className='w-full h-full object-cover'
        />
      ) : (
        meta.imageFallback
      )}
    </div>
  );

  const title = (
    <span
      className={`${s.title} font-semibold leading-tight text-fg line-clamp-2`}
      style={{ overflowWrap: 'anywhere' }}
    >
      {meta.title}
    </span>
  );

  const authorName = author && (
    <span className='flex items-center gap-1.5 min-w-0'>
      <Avatar src={author.avatarUrl} name={author.name} size={s.avatar} />
      <span className='truncate text-fg'>{author.name}</span>
      {author.verified && (
        <>
          <VerifiedBadge size={s.avatar - 2} className='flex-shrink-0' />
          <span className='sr-only'>(verified)</span>
        </>
      )}
    </span>
  );

  return (
    <div className='flex items-center gap-3 sm:gap-4 min-w-0 flex-1'>
      {meta.href ? (
        <a
          href={meta.href}
          target={linkTarget}
          rel={rel}
          aria-label={meta.title}
          className='flex-shrink-0'
        >
          {image}
        </a>
      ) : (
        image
      )}
      <div className='flex flex-col min-w-0 gap-1'>
        {meta.href ? (
          <a
            href={meta.href}
            target={linkTarget}
            rel={rel}
            className='min-w-0 cursor-pointer'
          >
            {title}
          </a>
        ) : (
          title
        )}
        {/* One line: author · gear · pill. Wrapped: gear · pill on top, author
            below. row-reverse + wrap gives both orders from one DOM order
            (gear first); justify-end keeps the lines left-aligned. */}
        {hasFacts && (
          <div className='flex flex-row-reverse flex-wrap justify-end items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted min-w-0'>
            {(meta.subtitle || meta.format) && (
              <span className='flex items-center gap-2 min-w-0 max-w-full'>
                {meta.subtitle && (
                  <span className='truncate'>{meta.subtitle}</span>
                )}
                <FormatPill format={meta.format} />
              </span>
            )}
            {author &&
              (author.href ? (
                <a
                  href={author.href}
                  target={linkTarget}
                  rel={rel}
                  className='min-w-0 max-w-full cursor-pointer'
                >
                  {authorName}
                </a>
              ) : (
                authorName
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
