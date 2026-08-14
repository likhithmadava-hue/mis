import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-solid';
import { For, Show } from 'solid-js';

import type { FocusMusic } from '../../core/db';
import type { FocusMusicState } from './createFocusMusic';
import { MUSIC_LABEL } from './musicTracks';

interface FocusMusicPanelProps {
  music: FocusMusicState;
}

const OPTIONS: FocusMusic[] = ['off', 'jazz', 'lofi'];

/** background music behind the timer — its own card, its own clock */
export default function FocusMusicPanel(props: FocusMusicPanelProps) {
  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
        <Music size={16} class="text-primary" /> Focus Music
      </h3>

      <div class="flex bg-background p-1 rounded-xl border border-border gap-1">
        <For each={OPTIONS}>
          {(opt) => (
            <button
              onClick={() => void props.music.setKind(opt)}
              class={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold font-space transition-colors ${
                props.music.kind() === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt === 'off' ? 'Off' : MUSIC_LABEL[opt]}
            </button>
          )}
        </For>
      </div>

      <Show when={props.music.kind() !== 'off'}>
        <div class="flex items-center gap-3">
          <button
            onClick={props.music.toggle}
            title={props.music.isPlaying() ? 'Pause' : 'Play'}
            class="p-2.5 rounded-xl bg-primary text-primary-foreground flex-shrink-0"
          >
            <Show when={props.music.isPlaying()} fallback={<Play size={15} />}>
              <Pause size={15} />
            </Show>
          </button>

          <span class="text-xs text-muted-foreground truncate flex-1" title={props.music.trackTitle() ?? undefined}>
            {props.music.trackTitle() ?? 'Not playing'}
          </span>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <Show when={props.music.volume() > 0} fallback={<VolumeX size={14} class="text-muted-foreground" />}>
              <Volume2 size={14} class="text-muted-foreground" />
            </Show>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={props.music.volume()}
              onInput={(e) => props.music.setVolume(Number(e.currentTarget.value))}
              onChange={(e) => void props.music.commitVolume(Number(e.currentTarget.value))}
              class="w-16 accent-primary"
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
