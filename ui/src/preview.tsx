import React from 'react';
import ReactDOM from 'react-dom/client';
import { T3kPlayer } from './components/T3kPlayer';
import { T3kDisabledPlayer } from './components/T3kDisabledPlayer';
import T3kAcordianPlayer from './components/Player/AcordianPlayer';
import T3kSlimPlayer from './components/Player/SlimPlayer';
import { T3kPlayerProvider } from './context/T3kPlayerProvider';
import './index.css';
import { InfoIcon } from 'lucide-react';
import { PREVIEW_MODE } from './types';
import { DEFAULT_INPUTS, DEFAULT_IRS, DEFAULT_MODELS } from './constants';

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className='text-xs uppercase tracking-wider text-zinc-500'>{children}</p>
);

const PreviewContent: React.FC = () => {
  return (
    <div className='neural-amp-modeler' style={{ minHeight: '100vh' }}>
      <div className='p-5 flex justify-center items-center'>
        <div className='flex flex-col gap-6 max-w-[700px] w-full'>
          <SectionLabel>SlimPlayer — baseline</SectionLabel>
          <div className='flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800'>
            <T3kSlimPlayer
              id='slim-player-1'
              getData={async () => ({
                model: DEFAULT_MODELS[0],
                ir: DEFAULT_IRS[1],
                input: DEFAULT_INPUTS[0],
              })}
              onPlayDemo={({ model, input, ir }) =>
                console.log('slim play', { model, input, ir })
              }
            />
            <span className='text-sm text-zinc-400'>
              {DEFAULT_MODELS[0].name} - {DEFAULT_INPUTS[0].name} -{' '}
              {DEFAULT_IRS[1].name}
            </span>
          </div>

          <SectionLabel>SlimPlayer — disabled prop</SectionLabel>
          <div className='flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800'>
            <T3kSlimPlayer
              id='slim-player-disabled'
              disabled
              getData={async () => ({
                model: DEFAULT_MODELS[0],
                ir: DEFAULT_IRS[1],
                input: DEFAULT_INPUTS[0],
              })}
            />
            <span className='text-sm text-zinc-400'>Forced disabled</span>
          </div>

          <SectionLabel>T3kPlayer — baseline</SectionLabel>
          <T3kPlayer
            id='player-baseline'
            isLoading={false}
            previewMode={PREVIEW_MODE.MODEL}
            models={DEFAULT_MODELS}
            onPlayDemo={({ model, input, ir }) =>
              console.log('play', { model, input, ir })
            }
          />

          <SectionLabel>T3kPlayer — disabled prop</SectionLabel>
          <T3kPlayer
            id='player-forced-disabled'
            disabled
            models={DEFAULT_MODELS}
            infoSlot={<InfoIcon size={20} className='text-zinc-400' />}
          />

          <SectionLabel>T3kDisabledPlayer — standalone export</SectionLabel>
          <T3kDisabledPlayer
            infoSlot={<InfoIcon size={20} className='text-zinc-400' />}
          />

          <SectionLabel>AcordianPlayer — baseline</SectionLabel>
          <T3kAcordianPlayer
            id='acordian-baseline'
            previewMode={PREVIEW_MODE.MODEL}
            getData={async () => ({
              models: DEFAULT_MODELS,
              irs: DEFAULT_IRS,
              inputs: DEFAULT_INPUTS,
            })}
          />

          <SectionLabel>AcordianPlayer — disabled prop</SectionLabel>
          <T3kAcordianPlayer
            id='acordian-forced-disabled'
            disabled
            previewMode={PREVIEW_MODE.MODEL}
            getData={async () => ({
              models: DEFAULT_MODELS,
              irs: DEFAULT_IRS,
              inputs: DEFAULT_INPUTS,
            })}
          />
        </div>
      </div>
    </div>
  );
};

const Preview: React.FC = () => {
  return (
    <T3kPlayerProvider>
      <PreviewContent />
    </T3kPlayerProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>
);

export default Preview;
