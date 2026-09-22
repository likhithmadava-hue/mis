/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every colour resolves through a CSS variable declared in index.css, so
      // `:root[data-mode='life']` can retint the entire app by overriding
      // --primary. Use these token classes; a hardcoded hex breaks Life mode.
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        elevated: 'hsl(var(--elevated))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        // the third text step: quieter than muted, still legible. For
        // denominators, empty states and anything that must recede.
        'subtle-foreground': 'hsl(var(--subtle-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-deep': 'hsl(var(--primary-deep))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        accent: 'hsl(var(--accent))',
        destructive: 'hsl(var(--destructive))',
        warning: 'hsl(var(--warning))',
        success: 'hsl(var(--success))',
        sidebar: 'hsl(var(--sidebar))',
        'sidebar-accent': 'hsl(var(--sidebar-accent))',
      },
      // Inter for body, Space Grotesk for headings, JetBrains Mono for numbers.
      // Shipped as local woff2 files (see src/fonts.css) — an installed desktop
      // app must not reach out to Google Fonts on launch.
      fontFamily: {
        space: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-short': {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-4px)' },
          '50%': { transform: 'translateY(0)' },
          '75%': { transform: 'translateY(-2px)' },
        },
        // database table: rows slide in one after another
        'row-in': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // checkboxes and badges: small overshoot pop
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '70%': { opacity: '1', transform: 'scale(1.15)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scan: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
        /* the split-flap digit's keyframes live in index.css beside the rest of
           its layers — the flaps need shading overlays and a duration driven by
           a custom property, neither of which a utility class can carry */
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        // same motion as fade-in but `both`, so a staggered animation-delay
        // holds the element invisible instead of flashing it first
        'rise-in': 'fade-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'bounce-short': 'bounce-short 0.6s ease-out',
        'row-in': 'row-in 0.35s ease-out both',
        'pop-in': 'pop-in 0.35s ease-out both',
        scan: 'scan 1s ease-in-out',
      },
    },
  },
  plugins: [],
};
