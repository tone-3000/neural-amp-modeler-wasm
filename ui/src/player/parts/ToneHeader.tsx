import React from 'react';
import { ToneMeta } from '../../types';
import { Avatar } from '../../components/ui/Avatar';
import { FormatPill } from '../../components/ui/FormatPill';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';

interface ToneHeaderProps {
  meta: ToneMeta;
  /**
   * `default` for the full layout, `dense` for compact, `inline` for the
   * tone's share of the `bar` row.
   */
  variant?: 'default' | 'dense' | 'inline';
  linkTarget?: '_blank' | '_self';
  /** A tone (title, image) or author link was followed. */
  onLinkClick?: (target: 'tone' | 'author', href: string) => void;
}

// Image sizes sit just under a two-line title plus the facts row (~72px /
// ~64px), so the thumbnail reads as the same block rather than an icon.
const SIZES = {
  default: { image: 68, title: 'text-base sm:text-lg', avatar: 20 },
  dense: { image: 56, title: 'text-sm sm:text-base', avatar: 18 },
  inline: { image: 48, title: 'text-sm', avatar: 16 },
} as const;

/**
 * Image, title, then one line of facts styled like a tone3000 tone card:
 * avatar name ✓ · subtitle (gear) · format pill.
 *
 * `inline` is two lines and no more, whatever the tone is called: a title
 * that truncates, over the author. The gear and format stay with the card
 * the tone was played from.
 */
export const ToneHeader: React.FC<ToneHeaderProps> = ({
  meta,
  variant = 'default',
  linkTarget = '_blank',
  onLinkClick,
}) => {
  const s = SIZES[variant];
  const inline = variant === 'inline';
  // `noopener` only: the destination may see which page linked to it.
  const rel = linkTarget === '_blank' ? 'noopener' : undefined;
  const { author } = meta;
  const toneClicked = () => {
    if (meta.href) onLinkClick?.('tone', meta.href);
  };
  const showGear = !inline && !!(meta.subtitle || meta.format);
  const hasFacts = showGear || !!author;

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

  const title = inline ? (
    <span
      className={`${s.title} block truncate font-semibold leading-tight text-fg`}
      // The whole name, for the pointer that hovers a truncated one.
      title={meta.title}
    >
      {meta.title}
    </span>
  ) : (
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
    <div
      className={`flex items-center min-w-0 flex-1 ${inline ? 'gap-3' : 'gap-3 sm:gap-4'}`}
    >
      {meta.href ? (
        <a
          href={meta.href}
          target={linkTarget}
          rel={rel}
          aria-label={meta.title}
          onClick={toneClicked}
          className='flex-shrink-0'
        >
          {image}
        </a>
      ) : (
        image
      )}
      <div className={`flex flex-col min-w-0 ${inline ? 'gap-0.5' : 'gap-1'}`}>
        {meta.href ? (
          <a
            href={meta.href}
            target={linkTarget}
            rel={rel}
            onClick={toneClicked}
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
          <div
            className={`flex flex-row-reverse justify-end items-center gap-x-3 text-muted min-w-0 ${
              inline
                ? 'flex-nowrap overflow-hidden text-xs'
                : 'flex-wrap gap-y-1 text-xs sm:text-sm'
            }`}
          >
            {showGear && (
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
                  onClick={() => onLinkClick?.('author', author.href!)}
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
