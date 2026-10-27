/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/player/**/*.{js,ts,jsx,tsx}',
    './src/embed/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
    './src/context/**/*.{js,ts,jsx,tsx}',
    './src/utils/**/*.{js,ts,jsx,tsx}',
    './src/types/**/*.{js,ts,jsx,tsx}',
    './src/index.ts',
    './src/preview.tsx',
  ],
  theme: {
    extend: {
      // Semantic colors resolve to the --t3k-* tokens declared in index.css.
      // Player code must use these (bg-surface, border-line, text-muted, …)
      // rather than palette colors so a theme is just a token sheet.
      colors: {
        canvas: 'var(--t3k-canvas)',
        surface: {
          DEFAULT: 'var(--t3k-surface)',
          2: 'var(--t3k-surface-2)',
        },
        line: {
          DEFAULT: 'var(--t3k-line)',
          strong: 'var(--t3k-line-strong)',
        },
        fg: 'var(--t3k-fg)',
        muted: {
          DEFAULT: 'var(--t3k-muted)',
          2: 'var(--t3k-muted-2)',
        },
        accent: {
          DEFAULT: 'var(--t3k-accent)',
          fg: 'var(--t3k-on-accent)',
        },
        link: 'var(--t3k-link)',
        success: 'var(--t3k-success)',
        danger: 'var(--t3k-danger)',
        warning: 'var(--t3k-warning)',
        toggle: {
          on: 'var(--t3k-toggle-on)',
          off: 'var(--t3k-toggle-off)',
          knob: 'var(--t3k-toggle-knob)',
        },
      },
      borderRadius: {
        t3k: 'var(--t3k-radius)',
        't3k-sm': 'var(--t3k-radius-sm)',
      },
      fontFamily: {
        sans: 'var(--t3k-font)',
        mono: 'var(--t3k-font-mono)',
      },
    },
  },
  plugins: [],
};
