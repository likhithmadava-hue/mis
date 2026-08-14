import type { AmbientSound } from '../../core/db';

/**
 * Ambient noise, synthesised on the fly instead of shipped as files — the same
 * trade `audio.ts` makes for the timer's chime: a noise generator is a few
 * lines of DSP, and a real rain/ocean recording would add multi-MB files for
 * something a filtered noise buffer already approximates well enough.
 *
 * Each colour renders a short buffer of random samples and loops it. A few
 * seconds is enough — noise has no melody to repeat, so the loop point is
 * inaudible. Rain and ocean layer two buffers through filters and a slow LFO
 * on top of that; they are honestly an approximation, not a recording.
 */

const LOOP_SECONDS = 8;

type Kind = Exclude<AmbientSound, 'off'>;

const whiteSamples = (length: number): Float32Array<ArrayBuffer> => {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return data;
};

/** Paul Kellet's refined pink-noise filter — a cheap, standard approximation */
const pinkSamples = (length: number): Float32Array<ArrayBuffer> => {
  const data = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = out * 0.11;
  }
  return data;
};

/** brown/red noise: a leaky integrator of white noise */
const brownSamples = (length: number): Float32Array<ArrayBuffer> => {
  const data = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return data;
};

const buildBuffer = (ctx: AudioContext, gen: (n: number) => Float32Array<ArrayBuffer>): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * LOOP_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  buffer.copyToChannel(gen(length), 0);
  return buffer;
};

const loopingSource = (ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode => {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
};

/** modulates `param` around `base` with a sine LFO — the slow swell in rain/ocean */
const lfo = (ctx: AudioContext, param: AudioParam, hz: number, depth: number, base: number): OscillatorNode => {
  param.setValueAtTime(base, ctx.currentTime);
  const osc = ctx.createOscillator();
  osc.frequency.value = hz;
  const depthGain = ctx.createGain();
  depthGain.gain.value = depth;
  osc.connect(depthGain).connect(param);
  osc.start();
  return osc;
};

interface Voice {
  stop: () => void;
}

const buildPlain = (ctx: AudioContext, master: GainNode, gen: (n: number) => Float32Array<ArrayBuffer>): Voice => {
  const src = loopingSource(ctx, buildBuffer(ctx, gen));
  src.connect(master);
  src.start();
  return { stop: () => src.stop() };
};

const buildRain = (ctx: AudioContext, master: GainNode): Voice => {
  const hiss = loopingSource(ctx, buildBuffer(ctx, whiteSamples));
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3000;
  band.Q.value = 0.6;
  const hissGain = ctx.createGain();
  hiss.connect(band).connect(hissGain).connect(master);

  const rumble = loopingSource(ctx, buildBuffer(ctx, brownSamples));
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 300;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.25;
  rumble.connect(low).connect(rumbleGain).connect(master);

  const swell = lfo(ctx, hissGain.gain, 0.3, 0.12, 0.6);

  hiss.start();
  rumble.start();
  return {
    stop: () => {
      hiss.stop();
      rumble.stop();
      swell.stop();
    },
  };
};

const buildOcean = (ctx: AudioContext, master: GainNode): Voice => {
  const base = loopingSource(ctx, buildBuffer(ctx, brownSamples));
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 500;
  const baseGain = ctx.createGain();
  base.connect(low).connect(baseGain).connect(master);

  const foam = loopingSource(ctx, buildBuffer(ctx, whiteSamples));
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 2000;
  const foamGain = ctx.createGain();
  foam.connect(high).connect(foamGain).connect(master);

  const baseSwell = lfo(ctx, baseGain.gain, 0.09, 0.35, 0.55);
  const foamSwell = lfo(ctx, foamGain.gain, 0.09, 0.1, 0.08);

  base.start();
  foam.start();
  return {
    stop: () => {
      base.stop();
      foam.stop();
      baseSwell.stop();
      foamSwell.stop();
    },
  };
};

const BUILDERS: Record<Kind, (ctx: AudioContext, master: GainNode) => Voice> = {
  white: (ctx, master) => buildPlain(ctx, master, whiteSamples),
  pink: (ctx, master) => buildPlain(ctx, master, pinkSamples),
  brown: (ctx, master) => buildPlain(ctx, master, brownSamples),
  rain: buildRain,
  ocean: buildOcean,
};

export interface NoiseHandle {
  stop: () => void;
  setVolume: (v: number) => void;
}

/** starts `kind` looping into `ctx.destination` at `volume`; caller owns the context */
export const startNoise = (ctx: AudioContext, kind: Kind, volume: number): NoiseHandle => {
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  const voice = BUILDERS[kind](ctx, master);
  return {
    stop: () => {
      voice.stop();
      master.disconnect();
    },
    setVolume: (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.05),
  };
};
