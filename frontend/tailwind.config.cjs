/** Tailwind config for the static production build. Mirrors the theme that was
 *  previously inlined for the CDN build. Run `npm run build:css` after changing
 *  classes so styles.tailwind.css stays in sync. */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  // Some classes are assembled at runtime (e.g. `bg-${cfg.color}-600` in the
  // lifecycle/signal controls), so the scanner can't see them — safelist the
  // palette + shades those use, across the relevant utilities and hover.
  safelist: [
    {
      pattern: /^(bg|text|border|ring|fill|stroke)-(slate|blue|purple|green|emerald|red|amber|orange|cyan)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'focus', 'group-hover'],
    },
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        slate: { 950: '#020617' },
        // Intersect brand (matches DESIGN.md / intersectmbo.org): light page
        // surface, deep-blue primary, orange as a limited secondary accent.
        surface: {
          DEFAULT: '#f1f5ff',
          dim: '#e9ecef',
          bright: '#ffffff',
          'container-lowest': '#f8fafc',
          'container-low': '#f1f5ff',
          container: '#e9ecef',
          'container-high': '#dfe3eb',
          'container-highest': '#d0d0d0',
        },
        'on-surface': { DEFAULT: '#1a1a1a', variant: '#505050' },
        'inverse-surface': '#2a2a2a',
        'inverse-on-surface': '#f5f5f5',
        outline: { DEFAULT: '#6c757d', variant: '#b0b0b0' },
        brand: {
          primary: '#0228aa',
          'on-primary': '#ffffff',
          'primary-container': '#e8f0ff',
          'on-primary-container': '#0228aa',
          'primary-fixed': '#e8f0ff',
          // Used in code as the primary-button hover/press states → darker blues.
          'primary-fixed-dim': '#011d8a',
          'primary-active': '#01166b',
          // Orange: brand secondary, used sparingly (reads as a caution accent).
          secondary: '#ff6b35',
          'on-secondary': '#ffffff',
          'secondary-container': '#ffe8d9',
          'on-secondary-container': '#ff6b35',
          tertiary: '#f0a500',
          'on-tertiary': '#ffffff',
          'tertiary-container': '#ffecc4',
          'on-tertiary-container': '#f0a500',
          error: '#d32f2f',
          'on-error': '#ffffff',
          'error-container': '#ffebee',
          'on-error-container': '#d32f2f',
        },
      },
      animation: { 'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
      typography: {
        DEFAULT: {
          css: {
            'pre code': {
              backgroundColor: 'transparent',
              color: '#e2e8f0',
              fontSize: '0.9rem',
              borderWidth: '0',
              padding: '0',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
