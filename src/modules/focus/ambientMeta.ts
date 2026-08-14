import type { AmbientSound, Brainwave } from '../../core/db';

export const AMBIENT_LABEL: Record<Exclude<AmbientSound, 'off'>, string> = {
  white: 'White Noise',
  pink: 'Pink Noise',
  brown: 'Brown Noise',
  rain: 'Rain',
  ocean: 'Ocean Waves',
};

export const BRAINWAVE_LABEL: Record<Exclude<Brainwave, 'off'>, string> = {
  delta: 'Delta — deep sleep (0.5–4 Hz)',
  theta: 'Theta — meditation (4–8 Hz)',
  alpha: 'Alpha — relaxed focus (8–12 Hz)',
  beta: 'Beta — alert focus (12–30 Hz)',
  gamma: 'Gamma — high alertness (30–100 Hz)',
};
