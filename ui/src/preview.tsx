import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { InfoIcon } from 'lucide-react';
import { T3kPlayer } from './player/T3kPlayer';
import { T3kPlayerProvider } from './context/T3kPlayerProvider';
import { PlayerEvent } from './types';
import { cabTone, demoTone, libraryTone, spaceTone } from './demo/tones';
import './index.css';

/**
 * Dev app: every cell of the layout × cardinality matrix, every status, and
 * an event log. `npm start` serves it on :3000. The embed harness lives at
 * /embed.html.
 */

const Section = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className='flex flex-col gap-3'>
    <div>
      <p className='text-xs uppercase tracking-wider text-muted'>{title}</p>
      {note && <p className='text-xs text-muted/70'>{note}</p>}
    </div>
    {children}
  </section>
);

/** Stand-in for a tone3000 search card so `docked` has something to dock to. */
const FakeCard = ({ children }: { children: React.ReactNode }) => (
  <div className='flex flex-col'>
    <div className='border border-b-0 border-line rounded-t-t3k bg-canvas px-6 py-5 flex gap-4 items-center'>
      <div className='w-16 h-16 rounded-lg bg-surface-2 flex-shrink-0' />
      <div className='flex flex-col gap-1'>
        <span className='font-semibold'>Host card title</span>
        <span className='text-sm text-muted'>
          Rendered by the host, not the player
        </span>
      </div>
    </div>
    {children}
  </div>
);

const EventLog = ({ events }: { events: string[] }) => (
  <pre className='text-[11px] leading-4 text-muted bg-surface border border-line rounded-t3k p-3 h-64 overflow-auto font-mono whitespace-pre-wrap'>
    {events.length
      ? events.join('\n')
      : 'Events from every player appear here.'}
  </pre>
);

const Preview: React.FC = () => {
  const [events, setEvents] = useState<string[]>([]);
  const log = useCallback(
    (name: string) => (e: PlayerEvent) => {
      if (e.type === 'resize') return; // noisy; see the embed harness
      const { type, ...rest } = e;
      setEvents(prev =>
        [
          `${name} › ${type} ${JSON.stringify(rest, (_k, v) => (v?.url ? v.name : v))}`,
          ...prev,
        ].slice(0, 200)
      );
    },
    []
  );

  return (
    <div className='neural-amp-modeler min-h-screen'>
      <div className='p-5 flex justify-center'>
        <div className='grid gap-10 w-full max-w-[1100px] lg:grid-cols-[1fr_320px]'>
          <div className='flex flex-col gap-10 min-w-0'>
            <Section
              title='single · mini'
              note='Carousel / list cells. Title is the aria-label.'
            >
              <div className='flex items-center gap-3 p-3 rounded-t3k bg-surface border border-line'>
                <T3kPlayer
                  tones={[demoTone(5, { lazy: true })]}
                  layout='mini'
                  onEvent={log('mini')}
                />
                <span className='text-sm text-muted'>
                  Boosted EVH 5153 · lazy assets
                </span>
                <T3kPlayer
                  tones={[demoTone(1)]}
                  layout='mini'
                  disabled
                  onEvent={log('mini-disabled')}
                />
                <span className='text-sm text-muted'>disabled</span>
              </div>
            </Section>

            <Section
              title='single · compact · docked'
              note='tone3000 search card. Full player minus the header; controls behind the chevron. Lazy assets.'
            >
              <FakeCard>
                <T3kPlayer
                  tones={[demoTone(2, { lazy: true })]}
                  layout='compact'
                  docked
                  linkTarget='_self'
                  headerSlot={
                    <InfoIcon size={20} className='text-muted flex-shrink-0' />
                  }
                  onEvent={log('compact')}
                />
              </FakeCard>
            </Section>

            <Section
              title='single · full'
              note='Tone page / share embed. Header from `meta`.'
            >
              <T3kPlayer
                tones={[demoTone(0)]}
                layout='full'
                onEvent={log('full')}
              />
            </Section>

            <Section
              title='single · full · library'
              note='The whole model list in one tone (v2 default player).'
            >
              <T3kPlayer
                tones={[libraryTone]}
                layout='full'
                onEvent={log('library')}
              />
            </Section>

            <Section
              title='playlist · full · live=false'
              note='Partner embed. The pager picks the tone; the bar + controls follow the active one. Third tone is lazy and fails.'
            >
              <T3kPlayer
                tones={[
                  demoTone(0),
                  demoTone(3, { lazy: true }),
                  demoTone(6, { lazy: true, fail: true }),
                  demoTone(4),
                  demoTone(1, { lazy: true, delayMs: 1500 }),
                ]}
                layout='full'
                live={false}
                onEvent={log('playlist')}
              />
            </Section>

            <Section
              title='playlist · compact · light'
              note='Dense header for the pager. theme="light" is the second token sheet.'
            >
              <div
                className='p-5 rounded-t3k'
                style={{ background: '#f4f4f4' }}
              >
                <T3kPlayer
                  tones={[demoTone(2), demoTone(5)]}
                  layout='compact'
                  defaultToneId='demo-5'
                  theme='light'
                  onEvent={log('playlist-compact')}
                />
              </div>
            </Section>

            <Section title='single · full · light'>
              <div
                className='p-5 rounded-t3k'
                style={{ background: '#f4f4f4' }}
              >
                <T3kPlayer
                  tones={[demoTone(4)]}
                  layout='full'
                  theme='light'
                  onEvent={log('full-light')}
                />
              </div>
            </Section>

            <Section
              title='gear matrix · compact'
              note='A space IR pack (mix knob beside the toggle, amp in front) and a cab capture (amp ahead of the model via preModels).'
            >
              <T3kPlayer
                tones={[spaceTone, cabTone]}
                layout='compact'
                onEvent={log('matrix')}
              />
            </Section>

            <Section title='statuses'>
              <div className='flex flex-col gap-4'>
                <T3kPlayer tones={[demoTone(0)]} layout='full' isLoading />
                <T3kPlayer
                  tones={[demoTone(0)]}
                  layout='compact'
                  disabled={{ reason: 'This tone has no A2 models yet.' }}
                />
                <T3kPlayer
                  tones={[demoTone(0, { meta: false })]}
                  layout='full'
                  attribution={false}
                  live={false}
                />
              </div>
            </Section>
          </div>

          <aside className='flex flex-col gap-3 lg:sticky lg:top-5 self-start'>
            <p className='text-xs uppercase tracking-wider text-muted'>
              onEvent
            </p>
            <EventLog events={events} />
            <a className='text-sm text-muted underline' href='/embed.html'>
              Embed harness →
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* The dev app serves the built engine assets from public/engine (copied
        by `npm start`); library consumers get bundler-resolved defaults. */}
    <T3kPlayerProvider engineAssets={{ assetBaseUrl: '/engine/' }}>
      <Preview />
    </T3kPlayerProvider>
  </React.StrictMode>
);
