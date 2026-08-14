import { Headphones, Pause, Play, Volume2, VolumeX, Waves } from 'lucide-solid';
import { Show } from 'solid-js';

import type { AmbientSound, Brainwave } from '../../core/db';
import { Select, type SelectOption } from '../../core/ui';
import { AMBIENT_LABEL, BRAINWAVE_LABEL } from './ambientMeta';
import type { AmbientSoundState } from './createAmbientSound';
import type { BrainwaveState } from './createBrainwave';

interface AmbientPanelProps {
  ambient: AmbientSoundState;
  brainwave: BrainwaveState;
}

const AMBIENT_OPTIONS: SelectOption<AmbientSound>[] = [
  { value: 'off', label: 'Off' },
  ...(Object.entries(AMBIENT_LABEL) as [Exclude<AmbientSound, 'off'>, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

const BRAINWAVE_OPTIONS: SelectOption<Brainwave>[] = [
  { value: 'off', label: 'Off' },
  ...(Object.entries(BRAINWAVE_LABEL) as [Exclude<Brainwave, 'off'>, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

interface LayerProps<T extends string> {
  icon: typeof Waves;
  title: string;
  kind: () => T;
  options: SelectOption<T>[];
  isPlaying: () => boolean;
  toggle: () => void;
  volume: () => number;
  setVolume: (v: number) => void;
  commitVolume: (v: number) => void;
  onKind: (v: T) => void;
  ariaLabel: string;
  hint?: string;
}

/** one sound layer — a Select, a play button and a volume slider, shared by both rows below */
function SoundLayer<T extends string>(props: LayerProps<T>) {
  return (
    <div class="space-y-3">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
        <props.icon size={16} class="text-primary" /> {props.title}
      </h3>

      <div class="flex items-center gap-2">
        <Select value={props.kind()} onChange={props.onKind} options={props.options} ariaLabel={props.ariaLabel} class="flex-1" />
        <Show when={props.kind() !== 'off'}>
          <button
            onClick={props.toggle}
            title={props.isPlaying() ? 'Pause' : 'Play'}
            class="p-2.5 rounded-xl bg-primary text-primary-foreground flex-shrink-0"
          >
            <Show when={props.isPlaying()} fallback={<Play size={15} />}>
              <Pause size={15} />
            </Show>
          </button>
        </Show>
      </div>

      <Show when={props.kind() !== 'off'}>
        <Show when={props.hint}>
          <p class="text-[0.6875rem] text-muted-foreground flex items-center gap-1.5">
            <Headphones size={12} class="flex-shrink-0" /> {props.hint}
          </p>
        </Show>
        <div class="flex items-center gap-1.5">
          <Show when={props.volume() > 0} fallback={<VolumeX size={14} class="text-muted-foreground" />}>
            <Volume2 size={14} class="text-muted-foreground" />
          </Show>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={props.volume()}
            onInput={(e) => props.setVolume(Number(e.currentTarget.value))}
            onChange={(e) => void props.commitVolume(Number(e.currentTarget.value))}
            class="flex-1 accent-primary"
          />
        </div>
      </Show>
    </div>
  );
}

/**
 * Ambient noise + binaural brainwave tones behind the timer — both synthesised
 * in-browser (see `noiseEngine.ts` / `binauralEngine.ts`) rather than shipped
 * as files, and both independent of Focus Music: any mix of the three can
 * play at once.
 */
export default function AmbientPanel(props: AmbientPanelProps) {
  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-5">
      <SoundLayer
        icon={Waves}
        title="Ambient Sound"
        kind={props.ambient.kind}
        options={AMBIENT_OPTIONS}
        isPlaying={props.ambient.isPlaying}
        toggle={props.ambient.toggle}
        volume={props.ambient.volume}
        setVolume={props.ambient.setVolume}
        commitVolume={props.ambient.commitVolume}
        onKind={(v) => void props.ambient.setKind(v)}
        ariaLabel="Ambient sound"
      />

      <div class="pt-5 border-t border-border">
        <SoundLayer
          icon={Headphones}
          title="Brainwave Tones"
          kind={props.brainwave.kind}
          options={BRAINWAVE_OPTIONS}
          isPlaying={props.brainwave.isPlaying}
          toggle={props.brainwave.toggle}
          volume={props.brainwave.volume}
          setVolume={props.brainwave.setVolume}
          commitVolume={props.brainwave.commitVolume}
          onKind={(v) => void props.brainwave.setKind(v)}
          ariaLabel="Brainwave tone"
          hint="Binaural beat — needs headphones, does nothing over speakers."
        />
      </div>
    </div>
  );
}
