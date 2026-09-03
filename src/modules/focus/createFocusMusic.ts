import { createSignal, onCleanup } from 'solid-js';

import { act, api, db, type FocusMusic } from '../../core/db';
import { MUSIC_TRACKS, type MusicTrack } from './musicTracks';

const shuffled = (tracks: MusicTrack[]): MusicTrack[] => {
  const copy = [...tracks];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * The focus-music player: an HTML5 `<audio>` element looping a shuffled
 * playlist from `musicTracks.ts`, reshuffled once it runs out.
 *
 * Deliberately independent of the pomodoro clock in `createFocusTimer.ts` —
 * pausing, finishing a round, or sitting through the "are you done?" dialog
 * never touches it. Coupling the two would mean the music cutting out
 * mid-track at exactly the moments it's most useful to keep going.
 */
export function createFocusMusic() {
  const settings = () => db.focus_settings;

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [trackTitle, setTrackTitle] = createSignal<string | null>(null);

  const audio = new Audio();
  audio.volume = settings().music_volume;
  audio.preload = 'auto';

  let queue: MusicTrack[] = [];

  // Takes `kind` explicitly rather than reading `settings().focus_music` — a
  // freshly picked genre in `setKind` has to play before that choice has
  // round-tripped through Rust and landed back in the store.
  const playNext = (kind: Exclude<FocusMusic, 'off'>) => {
    if (queue.length === 0) queue = shuffled(MUSIC_TRACKS[kind]);
    const next = queue.shift();
    if (!next) return;
    audio.src = next.file;
    setTrackTitle(next.title);
    // Best-effort: a webview that hasn't seen a user gesture yet will reject
    // this, same caveat as the timer's own chime in audio.ts. The reason is
    // still logged rather than swallowed outright — a silent failure here
    // looks identical to "nothing is wrong" from the UI alone.
    void audio.play().then(
      () => setIsPlaying(true),
      (err) => {
        console.error('Focus music failed to play:', next.file, err);
        setIsPlaying(false);
      },
    );
  };

  const onEnded = () => {
    const kind = settings().focus_music;
    if (kind !== 'off') playNext(kind);
  };
  audio.addEventListener('ended', onEnded);
  onCleanup(() => {
    audio.pause();
    audio.removeEventListener('ended', onEnded);
  });

  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    queue = [];
    setIsPlaying(false);
    setTrackTitle(null);
  };

  const toggle = () => {
    if (isPlaying()) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const kind = settings().focus_music;
    if (kind === 'off') return;
    if (audio.src) {
      void audio.play().then(
        () => setIsPlaying(true),
        (err) => {
          console.error('Focus music failed to play:', audio.src, err);
          setIsPlaying(false);
        },
      );
    } else {
      playNext(kind);
    }
  };

  const setKind = (kind: FocusMusic) => {
    stop();
    // Play on this click's own gesture, synchronously — not after the
    // `await` on the settings save. A webview's autoplay policy is keyed to
    // the user gesture that triggered the call; routing it through an IPC
    // round-trip first risks losing that and having the track silently
    // refuse to start. The save can happen in the background.
    if (kind !== 'off') playNext(kind);
    return act(api.saveFocusSettings({ ...settings(), focus_music: kind }));
  };

  /** live feedback while dragging the volume slider — local only, no write */
  const setVolume = (v: number) => {
    audio.volume = v;
  };

  /** persisted once the slider is released */
  const commitVolume = (v: number) =>
    act(api.saveFocusSettings({ ...settings(), music_volume: v }));

  return {
    kind: () => settings().focus_music,
    volume: () => settings().music_volume,
    isPlaying,
    trackTitle,
    toggle,
    setKind,
    setVolume,
    commitVolume,
  };
}

export type FocusMusicState = ReturnType<typeof createFocusMusic>;
