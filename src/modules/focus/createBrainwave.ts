import { createSignal, onCleanup } from 'solid-js';

import { act, api, db, type Brainwave } from '../../core/db';
import { startBinaural, type BinauralHandle } from './binauralEngine';

const audioContext = (): AudioContext | null => {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
};

/**
 * The binaural-beat player — same shape as `createAmbientSound.ts`, its own
 * context so it can run at the same time as the noise layer and Focus Music
 * without any of the three's start/stop touching the others.
 */
export function createBrainwave() {
  const settings = () => db.focus_settings;

  const [isPlaying, setIsPlaying] = createSignal(false);

  let ctx: AudioContext | null = null;
  let handle: BinauralHandle | null = null;

  const stop = () => {
    handle?.stop();
    handle = null;
    setIsPlaying(false);
  };

  onCleanup(() => {
    stop();
    void ctx?.close();
  });

  const play = () => {
    const band = settings().brainwave;
    if (band === 'off') return;
    try {
      ctx ??= audioContext();
      if (!ctx) return;
      handle?.stop();
      handle = startBinaural(ctx, band, settings().brainwave_volume);
      setIsPlaying(true);
    } catch {
      // audio unavailable — the panel just stays paused
      setIsPlaying(false);
    }
  };

  const toggle = () => {
    if (isPlaying()) stop();
    else play();
  };

  const setKind = async (band: Brainwave) => {
    stop();
    await act(api.saveFocusSettings({ ...settings(), brainwave: band }));
    if (band !== 'off') play();
  };

  /** live feedback while dragging the volume slider — local only, no write */
  const setVolume = (v: number) => {
    handle?.setVolume(v);
  };

  /** persisted once the slider is released */
  const commitVolume = (v: number) =>
    act(api.saveFocusSettings({ ...settings(), brainwave_volume: v }));

  return {
    kind: () => settings().brainwave,
    volume: () => settings().brainwave_volume,
    isPlaying,
    toggle,
    setKind,
    setVolume,
    commitVolume,
  };
}

export type BrainwaveState = ReturnType<typeof createBrainwave>;
