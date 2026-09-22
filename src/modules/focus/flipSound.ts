/**
 * The tactile click a split-flap tile makes as it lands. Synthesised rather
 * than a sample file, for the same reason as the timer's chime in `audio.ts`:
 * a couple of Web Audio nodes cost nothing to ship, and a real flap clack is
 * itself closer to filtered noise than to a tone anyway.
 *
 * One shared context, not one per tile — on a fresh countdown several digits
 * can flip in the same frame, and spinning up a context per tile would be
 * wasteful and risks a browser's concurrent-context cap.
 *
 * Best-effort like the rest of the timer's audio: a webview that blocks audio
 * until interaction will throw here, and the visible flip still carries the
 * moment on its own.
 */

let ctx: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (ctx) return ctx;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  ctx = Ctx ? new Ctx() : null;
  return ctx;
};

/**
 * Short bandpass-filtered noise burst — a clack, not a beep. Deliberately
 * quiet: this fires on every digit change, including once a second on the
 * countdown face, so it reads as a mechanical undertone rather than a beep
 * competing for attention.
 */
export const playFlipTick = () => {
  try {
    const c = getContext();
    if (!c) return;

    const duration = 0.045;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // linear decay envelope baked into the noise itself, so the burst is
      // front-loaded like a real card hitting its stop rather than a flat hiss
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.8;

    const gain = c.createGain();
    const now = c.currentTime;
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start(now);
    noise.stop(now + duration);
  } catch {
    // audio unavailable — the flip still animates silently
  }
};
