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
        surface: {
          DEFAULT: '#0228aa',
          dim: '#011d8a',
          bright: '#1d40d9',
          'container-lowest': '#0a1f7f',
          'container-low': '#0f2699',
          container: '#1155cc',
          'container-high': '#1a5fff',
          'container-highest': '#2353ff',
        },
        'on-surface': { DEFAULT: '#ffffff', variant: '#e8eef9' },
        'inverse-surface': '#f5f5f5',
        'inverse-on-surface': '#1d1c1d',
        outline: { DEFAULT: '#8a92a8', variant: '#5a6478' },
        brand: {
          primary: '#ff5722',
          'on-primary': '#ffffff',
          'primary-container': '#ff8a65',
          'on-primary-container': '#ffffff',
          'primary-fixed': '#ff8a65',
          'primary-fixed-dim': '#ff6e40',
          'primary-active': '#d84315',
          secondary: '#188038',
          'on-secondary': '#ffffff',
          'secondary-container': '#1b5e20',
          'on-secondary-container': '#ffffff',
          tertiary: '#ffc107',
          'on-tertiary': '#1d1c1d',
          'tertiary-container': '#ffb300',
          'on-tertiary-container': '#1d1c1d',
          error: '#d32f2f',
          'on-error': '#ffffff',
          'error-container': '#ffcdd2',
          'on-error-container': '#b71c1c',
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
