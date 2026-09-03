import { createSignal, onCleanup } from 'solid-js';

import { act, api, db, type AmbientSound } from '../../core/db';
import { startNoise, type NoiseHandle } from './noiseEngine';

const audioContext = (): AudioContext | null => {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
};

/**
 * The ambient-noise player: a synthesised loop from `noiseEngine.ts`, started
 * and stopped independently of both the pomodoro clock and Focus Music — see
 * `createFocusMusic.ts` for why the timer and the sound layers stay decoupled.
 * Deliberately its own `AudioContext` rather than sharing one with the
 * binaural layer, so either can be created lazily on first play without the
 * other's lifecycle getting in the way.
 */
export function createAmbientSound() {
  const settings = () => db.focus_settings;

  const [isPlaying, setIsPlaying] = createSignal(false);

  let ctx: AudioContext | null = null;
  let handle: NoiseHandle | null = null;

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
    const kind = settings().ambient_sound;
    if (kind === 'off') return;
    try {
      ctx ??= audioContext();
      if (!ctx) return;
      handle?.stop();
      handle = startNoise(ctx, kind, settings().ambient_volume);
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

  const setKind = async (kind: AmbientSound) => {
    stop();
    await act(api.saveFocusSettings({ ...settings(), ambient_sound: kind }));
    if (kind !== 'off') play();
  };

  /** live feedback while dragging the volume slider — local only, no write */
  const setVolume = (v: number) => {
    handle?.setVolume(v);
  };

  /** persisted once the slider is released */
  const commitVolume = (v: number) =>
    act(api.saveFocusSettings({ ...settings(), ambient_volume: v }));

  return {
    kind: () => settings().ambient_sound,
    volume: () => settings().ambient_volume,
    isPlaying,
    toggle,
    setKind,
    setVolume,
    commitVolume,
  };
}

export type AmbientSoundState = ReturnType<typeof createAmbientSound>;
