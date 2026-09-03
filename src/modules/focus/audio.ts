/**
 * The timer's two sounds, kept out of the component because Web Audio is all
 * imperative setup that has nothing to do with rendering.
 *
 * Both are synthesised rather than played from a file. Two oscillators and a
 * gain ramp are a few lines and no bytes; shipping two audio files would add
 * weight to the installer for sounds that are a chime and an arpeggio.
 *
 * Both are also best-effort: a webview that blocks audio until the user has
 * interacted with the page will throw, and the visual cues carry the moment on
 * their own. **Nothing here is allowed to break the timer.**
 */

const audioContext = (): AudioContext | null => {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
};

/** plays `freqs` as a short rising arpeggio on an existing context */
const arpeggio = (ctx: AudioContext, freqs: number[], step: number, peak: number, tail: number) => {
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * step;
    // An exponential ramp from a near-zero floor rather than from 0: Web Audio
    // refuses to ramp exponentially from silence, and a linear ramp clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tail);
    osc.start(start);
    osc.stop(start + 0.5);
  });
};

/** short chime so you notice a break ended without watching the screen */
export const playChime = () => {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    arpeggio(ctx, [880, 1320], 0.18, 0.25, 0.5);
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // audio unavailable — the visual cues still fire
  }
};

export interface Alarm {
  stop: () => void;
}

/**
 * The looping alarm for a finished focus round. It keeps ringing until the
 * "are you done?" dialog is answered, so the round cannot end unnoticed.
 * Returns null if audio is unavailable — the dialog still appears.
 */
export const startAlarm = (): Alarm | null => {
  try {
    const ctx = audioContext();
    if (!ctx) return null;
    const motif = [523.25, 659.25, 783.99, 1046.5]; // C5 · E5 · G5 · C6
    const play = () => arpeggio(ctx, motif, 0.16, 0.22, 0.45);
    play();
    const timer = window.setInterval(play, 2200);
    return {
      stop: () => {
        clearInterval(timer);
        void ctx.close();
      },
    };
  } catch {
    // audio unavailable — the dialog still appears
    return null;
  }
};
