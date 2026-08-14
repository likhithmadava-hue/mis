import type { Brainwave } from '../../core/db';

/**
 * Binaural-beat brainwave tones. A binaural beat is not a real sound — it's
 * two pure tones a few Hz apart, one per ear, that the brain perceives as a
 * single tone pulsing at the *difference* frequency. That only happens with
 * the two carriers isolated per ear, which is why this needs headphones and
 * does nothing over speakers (a single speaker sums both carriers back
 * together before they ever reach an ear).
 */

type Band = Exclude<Brainwave, 'off'>;

/** the beat frequency each band targets, in Hz — standard EEG band midpoints */
export const BRAINWAVE_HZ: Record<Band, number> = {
  delta: 2,
  theta: 6,
  alpha: 10,
  beta: 20,
  gamma: 40,
};

/** low enough to sit comfortably under the beat frequencies, not itself distracting */
const CARRIER_HZ = 200;

export interface BinauralHandle {
  stop: () => void;
  setVolume: (v: number) => void;
}

/** starts a `band` binaural beat into `ctx.destination` at `volume`; caller owns the context */
export const startBinaural = (ctx: AudioContext, band: Band, volume: number): BinauralHandle => {
  const beatHz = BRAINWAVE_HZ[band];

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  // Fade in rather than snap to volume — two sudden pure tones read as a
  // click, and this is what plays for long unattended stretches.
  master.gain.setTargetAtTime(volume, ctx.currentTime, 1.5);

  const merger = ctx.createChannelMerger(2);
  merger.connect(master);

  const left = ctx.createOscillator();
  left.type = 'sine';
  left.frequency.value = CARRIER_HZ;
  left.connect(merger, 0, 0);

  const right = ctx.createOscillator();
  right.type = 'sine';
  right.frequency.value = CARRIER_HZ + beatHz;
  right.connect(merger, 0, 1);

  left.start();
  right.start();

  return {
    stop: () => {
      const now = ctx.currentTime;
      master.gain.setTargetAtTime(0, now, 0.3);
      // Oscillators stop after the fade-out finishes, not before — a hard
      // stop mid-fade is the same audible click the fade was for.
      window.setTimeout(() => {
        left.stop();
        right.stop();
        master.disconnect();
      }, 500);
    },
    setVolume: (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
  };
};
