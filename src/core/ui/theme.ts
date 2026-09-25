import { createSignal } from 'solid-js';

/**
 * The appearance settings: which of the six themes is active, plus three
 * options that layer on top of any of them.
 *
 * A theme is nothing but a `data-theme` attribute on <html>. The palettes are
 * CSS variable blocks in `themes.css`, so switching is one attribute write —
 * every colour, radius and stroke in the app re-resolves in the same frame,
 * with no reload and no re-render of a single component.
 *
 * Stored under `app_theme_config` in localStorage (a view preference, not
 * vault data — it must be readable before the vault is). `public/theme-boot.js`
 * applies the same saved values from <head> before first paint; it duplicates
 * only the key and the defaults, so change those in both places.
 */

export const THEME_KEY = 'app_theme_config';

export const THEMES = [
  { id: 'cyberpunk', label: 'Cyberpunk Teal', tagline: 'Neon cyan on deep midnight', note: 'Default' },
  { id: 'oled', label: 'Midnight OLED', tagline: 'True black, electric violet', note: 'Saves power on OLED' },
  { id: 'obsidian', label: 'Solarized Obsidian', tagline: 'Warm charcoal and amber', note: 'Low eye strain' },
  { id: 'terminal', label: 'Retro Terminal', tagline: 'Phosphor green, square corners', note: 'Optional scanlines' },
  { id: 'nordic', label: 'Nordic Frost', tagline: 'Arctic blue on cool slate', note: 'Calm and quiet' },
  { id: 'aura', label: 'Aura Glass', tagline: 'Frosted panels over a soft mesh', note: 'Translucent' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export interface ThemeConfig {
  theme: ThemeId;
  /** monospaced type across the whole app */
  mono: boolean;
  /** thicker, brighter borders */
  highContrast: boolean;
  /** the CRT overlay; only Retro Terminal draws it */
  scanlines: boolean;
}

export const DEFAULT_THEME: ThemeConfig = {
  theme: 'cyberpunk',
  mono: false,
  highContrast: false,
  scanlines: true,
};

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/** A stored value is untrusted: a theme removed in a later build, or a hand-edited file. */
const read = (): ThemeConfig => {
  try {
    const raw = JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null') as Partial<ThemeConfig> | null;
    return {
      theme: isTheme(raw?.theme) ? raw.theme : DEFAULT_THEME.theme,
      mono: raw?.mono === true,
      highContrast: raw?.highContrast === true,
      scanlines: raw?.scanlines !== false,
    };
  } catch {
    return DEFAULT_THEME;
  }
};

const write = (config: ThemeConfig) => {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(config));
  } catch {
    // remembering is a convenience; a blocked store must not break switching
  }
};

const apply = (c: ThemeConfig) => {
  const root = document.documentElement;
  root.dataset.theme = c.theme;
  root.dataset.mono = c.mono ? 'on' : 'off';
  root.dataset.contrast = c.highContrast ? 'high' : 'normal';
  root.dataset.scanlines = c.scanlines ? 'on' : 'off';
};

const [themeConfig, setConfig] = createSignal<ThemeConfig>(read());
export { themeConfig };

/** Apply the saved config to <html>. Called once at startup, before render. */
export const initTheme = () => apply(themeConfig());

/** Change any part of the config: applied to <html> immediately, then remembered. */
export const updateTheme = (patch: Partial<ThemeConfig>) => {
  const next = { ...themeConfig(), ...patch };
  setConfig(next);
  apply(next);
  write(next);
};

export const resetTheme = () => updateTheme(DEFAULT_THEME);
