/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        accent: 'hsl(var(--accent))',
        destructive: 'hsl(var(--destructive))',
        warning: 'hsl(var(--warning))',
        success: 'hsl(var(--success))',
        sidebar: 'hsl(var(--sidebar))',
        'sidebar-accent': 'hsl(var(--sidebar-accent))',
      },
      // same font system as the original app:
      // Inter for body, Space Grotesk for headings, JetBrains Mono for numbers
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
        'scan': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
        // flip-clock digits: the new number swings down into place
        'flip': {
          '0%': { transform: 'rotateX(-90deg)', opacity: '0.2' },
          '60%': { transform: 'rotateX(8deg)', opacity: '1' },
          '100%': { transform: 'rotateX(0deg)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'bounce-short': 'bounce-short 0.6s ease-out',
        'row-in': 'row-in 0.35s ease-out both',
        'pop-in': 'pop-in 0.35s ease-out both',
        'scan': 'scan 1s ease-in-out',
        'flip': 'flip 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
