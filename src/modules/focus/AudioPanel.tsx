import { Pause, Play, Volume2, VolumeX } from 'lucide-solid';
import { createEffect, createSignal, For, on, Show } from 'solid-js';

import type { AmbientSound, Brainwave, FocusMusic } from '../../core/db';
import { Segmented, viewState } from '../../core/ui';
import { AMBIENT_LABEL, BRAINWAVE_LABEL } from './ambientMeta';
import type { AmbientSoundState } from './createAmbientSound';
import type { BrainwaveState } from './createBrainwave';
import type { FocusMusicState } from './createFocusMusic';
import { MUSIC_LABEL } from './musicTracks';

interface AudioPanelProps {
  music: FocusMusicState;
  ambient: AmbientSoundState;
  brainwave: BrainwaveState;
}

type ChannelId = 'music' | 'ambient' | 'wave';

interface Channel {
  id: ChannelId;
  label: string;
  options: { value: string; label: string }[];
  kind: () => string;
  pick: (value: string) => void;
  isPlaying: () => boolean;
  toggle: () => void;
  volume: () => number;
  /** live, while dragging — nothing is written */
  setVolume: (v: number) => void;
  /** on release — persisted */
  commitVolume: (v: number) => void;
  muted: () => boolean;
  setMuted: (m: boolean) => void;
  /** what the slider and the percentage show: 0 while muted, the drag position mid-drag */
  level: () => number;
  hint: () => string;
}

interface ChannelSource<T extends string> {
  id: ChannelId;
  label: string;
  options: { value: T; label: string }[];
  kind: () => T;
  setKind: (value: T) => unknown;
  isPlaying: () => boolean;
  toggle: () => void;
  volume: () => number;
  setVolume: (v: number) => void;
  commitVolume: (v: number) => unknown;
  hint: () => string;
}

/**
 * Adapts one of the three sound engines to the shape the panel draws, and adds
 * the one thing none of them has: mute.
 *
 * Mute is deliberately *not* a persisted volume of zero. It silences the layer
 * live (`setVolume(0)`) and remembers nothing on disk, so unmuting returns to
 * the level you set rather than to whatever the slider was dragged to, and a
 * muted session can never leave a layer saved at 0 that looks broken tomorrow.
 * It also clears itself whenever the layer starts over (a new source, or play
 * after a pause), because those restart the sound at the saved volume and a
 * "muted" button over an audible sound would be a lie.
 */
function channel<T extends string>(src: ChannelSource<T>): Channel {
  const [muted, setMutedSignal] = createSignal(false);
  // The slider's position while it is being dragged. `src.volume()` only moves
  // once the release has been written and reloaded, so without this the
  // percentage would sit still under a moving thumb.
  const [live, setLive] = createSignal<number | null>(null);

  const setMuted = (m: boolean) => {
    setMutedSignal(m);
    src.setVolume(m ? 0 : src.volume());
  };
  /** back to audible at the saved level — every path that ends a mute goes through here */
  const unmute = () => {
    if (muted()) setMuted(false);
  };

  createEffect(on(src.kind, unmute, { defer: true }));

  return {
    id: src.id,
    label: src.label,
    options: src.options,
    kind: src.kind,
    pick: (v) => void src.setKind(v as T),
    isPlaying: src.isPlaying,
    toggle: () => {
      unmute();
      src.toggle();
    },
    volume: src.volume,
    setVolume: (v) => {
      setLive(v);
      src.setVolume(v);
    },
    commitVolume: (v) =>
      void Promise.resolve(src.commitVolume(v)).finally(() => setLive(null)),
    muted,
    setMuted,
    level: () => (muted() ? 0 : (live() ?? src.volume())),
    hint: src.hint,
  };
}

/** the part of a brainwave label before its dash: "Alpha — relaxed focus (8–12 Hz)" → "Alpha" */
const shortName = (label: string) => label.split(' — ')[0];

const AMBIENT_OPTIONS = (Object.entries(AMBIENT_LABEL) as [Exclude<AmbientSound, 'off'>, string][]).map(
  ([value, label]) => ({ value, label }),
);
const BRAINWAVE_OPTIONS = (
  Object.entries(BRAINWAVE_LABEL) as [Exclude<Brainwave, 'off'>, string][]
).map(([value, label]) => ({ value, label: shortName(label) }));
const MUSIC_OPTIONS = (Object.entries(MUSIC_LABEL) as [Exclude<FocusMusic, 'off'>, string][]).map(
  ([value, label]) => ({ value, label }),
);
const OFF = { value: 'off', label: 'Off' } as const;

/**
 * Focus music, ambient noise and binaural tones as one panel with a tab per
 * channel, instead of three cards. Any mix can play at once; the tab's dot says
 * which channels are sounding so you do not have to visit each one to find out.
 *
 * Every channel has the same anatomy — source chips, then play, mute and volume
 * — so the card is the same height on every tab. The chip area reserves two
 * rows and the hint one line, because a card that changed height with the
 * channel would shove the settings card below it up and down.
 */
export default function AudioPanel(props: AudioPanelProps) {
  const channels: Channel[] = [
    channel<FocusMusic>({
      id: 'music',
      label: 'Music',
      options: [OFF, ...MUSIC_OPTIONS] as { value: FocusMusic; label: string }[],
      kind: props.music.kind,
      setKind: props.music.setKind,
      isPlaying: props.music.isPlaying,
      toggle: props.music.toggle,
      volume: props.music.volume,
      setVolume: props.music.setVolume,
      commitVolume: props.music.commitVolume,
      hint: () =>
        props.music.kind() === 'off'
          ? 'Instrumental tracks to study to.'
          : (props.music.trackTitle() ?? 'Not playing'),
    }),
    channel<AmbientSound>({
      id: 'ambient',
      label: 'Ambient',
      options: [OFF, ...AMBIENT_OPTIONS] as { value: AmbientSound; label: string }[],
      kind: props.ambient.kind,
      setKind: props.ambient.setKind,
      isPlaying: props.ambient.isPlaying,
      toggle: props.ambient.toggle,
      volume: props.ambient.volume,
      setVolume: props.ambient.setVolume,
      commitVolume: props.ambient.commitVolume,
      hint: () => 'Steady background sound that masks distractions.',
    }),
    channel<Brainwave>({
      id: 'wave',
      label: 'Brainwave',
      options: [OFF, ...BRAINWAVE_OPTIONS] as { value: Brainwave; label: string }[],
      kind: props.brainwave.kind,
      setKind: props.brainwave.setKind,
      isPlaying: props.brainwave.isPlaying,
      toggle: props.brainwave.toggle,
      volume: props.brainwave.volume,
      setVolume: props.brainwave.setVolume,
      commitVolume: props.brainwave.commitVolume,
      hint: () => {
        const kind = props.brainwave.kind();
        return kind === 'off'
          ? 'Binaural beat — needs headphones, does nothing over speakers.'
          : `${BRAINWAVE_LABEL[kind]} · needs headphones`;
      },
    }),
  ];

  // Which channel is open survives a tab switch, like every other view state.
  const [active, setActive] = viewState<ChannelId>(
    'focus.channel',
    'music',
    (v) => channels.some((c) => c.id === v),
  );
  const current = () => channels.find((c) => c.id === active()) ?? channels[0];

  const sounding = (c: Channel) => c.kind() !== 'off' && c.isPlaying() && !c.muted();
  const off = () => current().kind() === 'off';

  // Built once, not inside the JSX: the options are read by a `<For>`, and an
  // array rebuilt whenever a dot changes would recreate every tab button — and
  // drop the keyboard focus from the one you just arrowed onto.
  const tabs = channels.map((c) => ({
    value: c.id,
    label: (
      <span class="inline-flex items-center justify-center gap-1.5">
        {c.label}
        <span
          aria-hidden="true"
          class={`w-1.5 h-1.5 rounded-full ${
            sounding(c)
              ? c.id === active()
                ? 'bg-primary-foreground'
                : 'bg-primary'
              : 'bg-subtle-foreground/60'
          }`}
        />
        <Show when={sounding(c)}>
          <span class="sr-only">playing</span>
        </Show>
      </span>
    ),
  }));

  return (
    <section
      aria-labelledby="audio-title"
      class="bg-card rounded-2xl border border-border card-shadow p-6"
    >
      <h3 id="audio-title" class="text-base font-bold font-space">
        Audio
      </h3>

      <Segmented
        class="mt-4"
        size="sm"
        ariaLabel="Audio channel"
        value={active()}
        onChange={setActive}
        options={tabs}
      />

      <div role="tabpanel" aria-label={`${current().label} controls`} class="mt-5">
        <p class="h-4 text-[0.6875rem] text-muted-foreground truncate" title={current().hint()}>
          {current().hint()}
        </p>

        <div class="mt-3 flex flex-wrap content-start gap-2 min-h-[4.75rem]">
          <For each={current().options}>
            {(opt) => (
              <button
                type="button"
                aria-pressed={current().kind() === opt.value}
                onClick={() => current().pick(opt.value)}
                class={`h-8 px-3 rounded-lg border text-xs transition-colors ${
                  current().kind() === opt.value
                    ? 'border-primary bg-primary/15 text-primary font-bold'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>

        {/* always drawn, dimmed while Off — see the note on the component */}
        <div
          class={`mt-3 flex items-center gap-3 transition-opacity ${off() ? 'opacity-50' : ''}`}
          aria-disabled={off()}
        >
          <button
            type="button"
            onClick={() => current().toggle()}
            disabled={off()}
            title={current().isPlaying() ? 'Pause' : 'Play'}
            aria-label={`${current().isPlaying() ? 'Pause' : 'Play'} ${current().label}`}
            class="grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl bg-primary text-primary-foreground disabled:cursor-not-allowed"
          >
            <Show when={current().isPlaying()} fallback={<Play size={15} />}>
              <Pause size={15} />
            </Show>
          </button>
          <button
            type="button"
            onClick={() => current().setMuted(!current().muted())}
            disabled={off()}
            aria-pressed={current().muted()}
            title={current().muted() ? 'Unmute' : 'Mute'}
            aria-label={`${current().muted() ? 'Unmute' : 'Mute'} ${current().label}`}
            class={`grid place-items-center w-10 h-10 flex-shrink-0 rounded-xl border transition-colors disabled:cursor-not-allowed ${
              current().muted()
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            <Show when={current().muted()} fallback={<Volume2 size={16} />}>
              <VolumeX size={16} />
            </Show>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={off()}
            value={current().level()}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              if (current().muted()) current().setMuted(false);
              current().setVolume(v);
            }}
            onChange={(e) => current().commitVolume(Number(e.currentTarget.value))}
            class="flex-1 min-w-0 accent-primary"
            aria-label={`${current().label} volume`}
          />
          <output class="w-10 flex-shrink-0 text-right text-xs font-mono tabular-nums text-muted-foreground">
            {Math.round(current().level() * 100)}%
          </output>
        </div>
      </div>
    </section>
  );
}
