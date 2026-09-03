import type { FocusMusic } from '../../core/db';

export interface MusicTrack {
  title: string;
  file: string;
}

/**
 * Public-dir assets, not imports — these are multi-MB audio files, and Vite
 * would otherwise try to run them through the module graph. `BASE_URL` is
 * `'./'` (see vite.config.ts), so the resulting path resolves against
 * whatever origin the app is actually served from, dev server or the Tauri
 * asset protocol alike.
 */
const asset = (path: string) => `${import.meta.env.BASE_URL}audio/${path}`;

/**
 * All ten tracks are CC0 1.0 (public domain) by HoliznaCC0 — see
 * `public/audio/CREDITS.txt` for the source albums. CC0 needs no
 * attribution; the file exists so the license is checkable, not because
 * anything here requires it.
 */
export const MUSIC_TRACKS: Record<Exclude<FocusMusic, 'off'>, MusicTrack[]> = {
  jazz: [
    { title: 'Cafe Jazz — Session I', file: asset('jazz/jazz-1.mp3') },
    { title: 'Cafe Jazz — Session II', file: asset('jazz/jazz-2.mp3') },
    { title: 'Cafe Jazz — Session III', file: asset('jazz/jazz-3.mp3') },
    { title: 'Cafe Jazz — Session IV', file: asset('jazz/jazz-4.mp3') },
  ],
  lofi: [
    { title: 'Morning Coffee', file: asset('lofi/morning-coffee.mp3') },
    { title: 'Autumn', file: asset('lofi/autumn.mp3') },
    { title: 'Vintage', file: asset('lofi/vintage.mp3') },
    { title: 'Clouds', file: asset('lofi/clouds.mp3') },
    { title: 'Cellar Door', file: asset('lofi/cellar-door.mp3') },
    { title: 'Seasons Change', file: asset('lofi/seasons-change.mp3') },
  ],
};

export const MUSIC_LABEL: Record<Exclude<FocusMusic, 'off'>, string> = {
  jazz: 'Cafe Jazz',
  lofi: 'Lofi Beats',
};
