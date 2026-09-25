/**
 * Generates src/themes.css from the six palettes below.  Run: `npm run themes`.
 *
 * The palettes are the single source of truth. Tailwind reads every colour as
 * `hsl(var(--token))`, so each hex is converted to an "H S% L%" triplet here
 * instead of by hand — a hand conversion is exactly where a #0B1320 quietly
 * becomes a slightly different blue.
 *
 * Only seven colours per theme are specified (background, card, border, the two
 * accents, two text steps). The rest of the token set — the muted and elevated
 * surfaces, the quietest text tier, the on-accent colour, the accent wash — is
 * derived from those seven, and **every text colour is checked against AA
 * (4.5:1) on the lightest surface it can sit on.** A specified colour that
 * fails is lightened toward the primary text colour just far enough to pass,
 * and the adjustment is printed, so a palette can never ship unreadable text
 * without somebody having seen it happen.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── colour maths ────────────────────────────────────────────────────────────
const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hsl = (rgb) => {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const f = (n) => Math.round(n * 10) / 10;
  return `${f(h)} ${f(s * 100)}% ${f(l * 100)}%`;
};
const darken = (rgb, k) => {
  const [r, g, b] = rgb.map((v) => v / 255);
  // scale lightness in HSL space, keep hue and saturation
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const l2 = l * k;
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
  const p = 2 * l2 - q;
  const c = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return s === 0 ? [l2 * 255, l2 * 255, l2 * 255] : [c(h + 1 / 3) * 255, c(h) * 255, c(h - 1 / 3) * 255];
};

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const notes = [];

/** lighten `fg` toward `toward` until it clears `min` on every surface in `on` */
const ensure = (theme, label, fg, on, min, toward) => {
  let out = fg;
  let t = 0;
  const worst = () => Math.min(...on.map((s) => contrast(out, s)));
  const before = worst();
  while (worst() < min && t < 1) {
    t += 0.02;
    out = mix(fg, toward, t);
  }
  if (t > 0) {
    notes.push(
      `${theme}: ${label} ${toHex(fg)} was ${before.toFixed(2)}:1 on its surfaces — lightened to ${toHex(out)} (${worst().toFixed(2)}:1)`,
    );
  }
  return out;
};

// ── the six palettes ────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'cyberpunk',
    isDefault: true,
    bg: '#0B1320', card: '#111C2E', border: '#1E2D4A',
    primary: '#00E5FF', secondary: '#00FFB2', text: '#F0F6FC', text2: '#8B949E',
    radius: '6px',
    shadowCard: '0 1px 0 hsl(0 0% 100% / 0.03) inset, 0 4px 14px -8px hsl(0 0% 0% / 0.6)',
    shadowRaised: '0 1px 0 hsl(0 0% 100% / 0.05) inset, 0 8px 22px -12px hsl(0 0% 0% / 0.7)',
    shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.2), 0 8px 32px -8px hsl(var(--primary) / 0.25)',
    glow: 'radial-gradient(circle at 70% 0%, hsl(var(--primary) / 0.07), transparent 35%)',
  },
  {
    id: 'oled',
    bg: '#000000', card: '#0D0D0D', border: '#262626', cardBorder: '#333333',
    primary: '#8B5CF6', secondary: '#10B981', text: '#FFFFFF', text2: '#A1A1AA',
    radius: '4px',
    shadowCard: 'none', shadowRaised: 'none', shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.5)',
    glow: 'none',
  },
  {
    id: 'obsidian',
    bg: '#121212', card: '#1E1B18', border: '#332D27',
    primary: '#F59E0B', secondary: '#D97706', text: '#F5F2EB', text2: '#A8A29E',
    radius: '8px',
    shadowCard: '0 1px 0 hsl(35 60% 90% / 0.03) inset, 0 6px 18px -10px hsl(0 0% 0% / 0.55)',
    shadowRaised: '0 1px 0 hsl(35 60% 90% / 0.04) inset, 0 12px 28px -14px hsl(0 0% 0% / 0.65)',
    shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 0 18px -4px hsl(var(--primary) / 0.35)',
    glow: 'radial-gradient(circle at 75% 0%, hsl(var(--primary) / 0.06), transparent 38%)',
  },
  {
    id: 'terminal',
    bg: '#050B05', card: '#0A150A', border: '#153315',
    primary: '#22C55E', secondary: '#06B6D4', text: '#4ADE80', text2: '#166534',
    radius: '0px', borderWidth: '2px',
    success: '#4ADE80',
    shadowCard: 'none', shadowRaised: 'none',
    shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.5), 0 0 10px hsl(var(--primary) / 0.3)',
    glow: 'none',
  },
  {
    id: 'nordic',
    bg: '#0F172A', card: '#1E293B', border: '#334155',
    primary: '#38BDF8', secondary: '#818CF8', text: '#F8FAFC', text2: '#94A3B8',
    radius: '10px',
    // low-saturation status colours: badges here inform, they do not shout
    destructive: '#E29A9A', warning: '#DDBB86', success: '#86C9AE',
    shadowCard: '0 8px 26px -16px hsl(199 89% 60% / 0.22)',
    shadowRaised: '0 14px 34px -18px hsl(199 89% 60% / 0.3)',
    shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.22), 0 8px 30px -10px hsl(var(--primary) / 0.28)',
    glow:
      'radial-gradient(ellipse at 15% 0%, hsl(var(--primary) / 0.13), transparent 46%), radial-gradient(ellipse at 95% 8%, hsl(var(--secondary-accent) / 0.09), transparent 42%)',
  },
  {
    id: 'aura',
    // Glass sits on a gradient, so the opaque tokens below are computed against
    // the gradient's average colour. They are what the contrast check runs on and
    // the fallback if backdrop-filter is unavailable; theme-effects.css paints
    // the real translucent surfaces on top.
    bg: '#211E43', glass: true,
    primary: '#C084FC', secondary: '#38BDF8', text: '#FFFFFF',
    radius: '12px',
    sidebar: '#161433',
    shadowCard: '0 1px 0 hsl(0 0% 100% / 0.08) inset, 0 8px 32px -8px hsl(0 0% 0% / 0.45), 0 2px 8px -2px hsl(0 0% 0% / 0.3)',
    shadowRaised: '0 1px 0 hsl(0 0% 100% / 0.1) inset, 0 16px 44px -10px hsl(0 0% 0% / 0.55), 0 4px 12px -2px hsl(0 0% 0% / 0.3)',
    shadowGlow: '0 0 0 1px hsl(var(--primary) / 0.3), 0 8px 32px -8px hsl(var(--primary) / 0.4)',
    glow:
      'radial-gradient(circle at 18% 12%, hsl(var(--primary) / 0.16), transparent 42%), radial-gradient(circle at 85% 80%, hsl(var(--secondary-accent) / 0.12), transparent 45%), linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  },
];

// ── derive ──────────────────────────────────────────────────────────────────
const DEFAULT_STATUS = { destructive: '#FF6B6B', warning: '#FFB84D', success: '#36D399' };

function derive(t) {
  const bg = hex(t.bg);
  const text = hex(t.text);
  let card;
  let border;
  let text2;
  if (t.glass) {
    card = mix(bg, WHITE, 0.05); // rgba(255,255,255,0.05) over the gradient
    border = mix(card, WHITE, 0.12); // rgba(255,255,255,0.12)
    text2 = mix(bg, WHITE, 0.65); // rgba(255,255,255,0.65)
  } else {
    card = hex(t.card);
    border = hex(t.border);
    text2 = hex(t.text2);
  }
  const muted = mix(card, text, 0.035);
  const elevated = mix(card, text, 0.065);
  const surfaces = [bg, card, muted, elevated];

  const mutedFg = ensure(t.id, 'secondary text', text2, surfaces, 4.5, text);
  // the quietest tier sits between the secondary text and the surface
  let subtle = mix(mutedFg, elevated, 0.28);
  subtle = ensure(t.id, 'quietest text', subtle, surfaces, 4.5, mutedFg);

  const primary = ensure(t.id, 'primary accent', hex(t.primary), surfaces, 4.5, text);
  const secondaryAccent = ensure(t.id, 'secondary accent', hex(t.secondary), surfaces, 4.5, text);
  // text on a filled accent button: whichever of the theme's own darkest and pure white reads better
  const onPrimary = contrast(bg, primary) >= contrast(WHITE, primary) ? bg : WHITE;
  notes.push(
    `${t.id}: on-accent text ${toHex(onPrimary)} on ${toHex(primary)} = ${contrast(onPrimary, primary).toFixed(2)}:1`,
  );

  const status = {};
  for (const k of ['destructive', 'warning', 'success']) {
    status[k] = ensure(t.id, k, hex(t[k] ?? DEFAULT_STATUS[k]), surfaces, 4.5, text);
  }

  const sidebar = t.sidebar
    ? hex(t.sidebar)
    : lum(bg) < 0.005
      ? mix(bg, WHITE, 0.02)
      : mix(bg, BLACK, 0.25);

  return {
    bg, card, border, muted, elevated, text, mutedFg, subtle, primary, secondaryAccent,
    onPrimary, status, sidebar,
    borderHc: mix(border, text, 0.42),
    cardBorder: t.cardBorder ? hex(t.cardBorder) : border,
  };
}

function block(t, d) {
  const sel = [
    ...(t.isDefault ? [':root'] : []),
    `:root[data-theme='${t.id}']`,
    `[data-theme-preview='${t.id}']`,
  ].join(',\n');
  const life = d.secondaryAccent;
  const lines = [
    `color-scheme: dark;`,
    ``,
    `--background: ${hsl(d.bg)};       /* ${t.glass ? 'gradient average — see --gradient-glow' : t.bg} */`,
    `--foreground: ${hsl(d.text)};`,
    `--card: ${hsl(d.card)};`,
    `--border: ${hsl(d.border)};`,
    `--muted: ${hsl(d.muted)};`,
    `--elevated: ${hsl(d.elevated)};`,
    `--muted-foreground: ${hsl(d.mutedFg)};   /* ${toHex(d.mutedFg)} */`,
    `--subtle-foreground: ${hsl(d.subtle)};   /* ${toHex(d.subtle)} */`,
    `--primary: ${hsl(d.primary)};   /* ${toHex(d.primary)} */`,
    `--primary-deep: ${hsl(darken(d.primary, 0.62))};`,
    `--primary-foreground: ${hsl(d.onPrimary)};`,
    `--secondary: ${hsl(d.elevated)};`,
    `--secondary-accent: ${hsl(d.secondaryAccent)};   /* ${toHex(d.secondaryAccent)} */`,
    `--accent: ${hsl(mix(d.card, d.primary, 0.14))};`,
    `--destructive: ${hsl(d.status.destructive)};`,
    `--warning: ${hsl(d.status.warning)};`,
    `--success: ${hsl(d.status.success)};`,
    `--sidebar: ${hsl(d.sidebar)};`,
    `--sidebar-accent: ${hsl(d.muted)};`,
    ``,
    `/* Life mode wears this theme's second accent */`,
    `--primary-life: ${hsl(life)};`,
    `--primary-deep-life: ${hsl(darken(life, 0.62))};`,
    `--primary-foreground-life: ${hsl(contrast(hex(t.bg), life) >= contrast(WHITE, life) ? hex(t.bg) : WHITE)};`,
    `--accent-life: ${hsl(mix(d.card, life, 0.14))};`,
    ``,
    `--border-hc: ${hsl(d.borderHc)};`,
    `--card-border: ${hsl(d.cardBorder)};`,
    `--border-width: ${t.borderWidth ?? '1px'};`,
    `--radius: ${t.radius};`,
    ``,
    `--gradient-glow: ${t.glow};`,
    `--shadow-card: ${t.shadowCard};`,
    `--shadow-raised: ${t.shadowRaised};`,
    `--shadow-glow: ${t.shadowGlow};`,
  ];
  return `${sel} {\n${lines.map((l) => (l ? '  ' + l : '')).join('\n')}\n}\n`;
}

const css =
  `/* GENERATED by scripts/gen-themes.mjs — edit the palettes there and run \`npm run themes\`.\n` +
  `\n` +
  `   Every theme is a set of design tokens on <html data-theme='…'>. The same block\n` +
  `   also answers to [data-theme-preview='…'], which is how the Appearance page\n` +
  `   draws each swatch from the real tokens instead of a second copy of the colours.\n` +
  `   cyberpunk also owns :root, so the app is never unthemed. Structure that a\n` +
  `   token cannot carry (glass, scanlines, glow) is in theme-effects.css. */\n\n` +
  THEMES.map((t) => block(t, derive(t))).join('\n');

const out = fileURLToPath(new URL('../src/themes.css', import.meta.url));
writeFileSync(out, css);
console.log(`wrote ${out}`);
for (const n of notes) console.log('  ' + n);
