import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Clinical Teal — the brand. 700 is the working primary: it clears
        // 6:1 on white, so the same value serves a filled button, an active
        // nav item and an inline link without any of them being borderline.
        // Mirrors --brand-* in index.css; change both together.
        primary: {
          50: '#F1FAF7',
          100: '#DBF1EB',
          200: '#B4E2D7',
          300: '#83CDBD',
          400: '#4EB09C',
          500: '#2A9280',
          600: '#1E7B6B',
          700: '#156B5E',
          800: '#11564C',
          900: '#0F463E',
          950: '#062722',
        },
        // Carbon — warm near-black for the sidebar and dark chrome. Shares
        // the ink ramp's warmth, so chrome and page read as one material.
        carbon: {
          500: '#3A3731',
          600: '#2B2924',
          700: '#201E1A',
          800: '#181614',
          900: '#121110',
          950: '#0B0A09',
        },
        // Steel blue — the comparison series in charts, and the second
        // voice anywhere teal is already spoken for.
        secondary: {
          50: '#F0F4FA',
          100: '#DDE6F3',
          200: '#BFCFE7',
          300: '#99B1D6',
          400: '#6E8DBF',
          500: '#4E6FA5',
          600: '#3C5E93',
          700: '#324C77',
          800: '#2A3E60',
          900: '#24344E',
        },
        // Warm ink ramp. Every grey in the product comes from here; a cool
        // grey next to the teal makes both look accidental.
        ink: {
          25: '#FDFDFC',
          50: '#FAF9F7',
          100: '#F4F3F0',
          200: '#E9E7E2',
          300: '#D8D5CE',
          400: '#B0ACA3',
          500: '#78746C',
          600: '#635F58',
          700: '#4A4741',
          800: '#302E2A',
          900: '#1D1B19',
          950: '#110F0E',
        },
        // Distinct, accessible Agent identity colours (spec §1)
        clinical: '#157A6B',     // Clinical Teal
        medication: '#7B4FA8',   // Plum
        followup: '#2A7F4C',     // Forest
        education: '#99650D',    // Ochre
        orchestrator: '#3C5E93', // Steel
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        '9.5': '2.375rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      // Warm-tinted, and tight. A shadow here is meant to say how far off
      // the page something sits, not to draw attention to itself — the
      // coloured outer glows this replaces were doing the latter.
      boxShadow: {
        xs: '0 1px 2px 0 rgb(28 25 23 / 0.05)',
        sm: '0 1px 2px 0 rgb(28 25 23 / 0.05), 0 1px 3px 0 rgb(28 25 23 / 0.06)',
        md: '0 2px 4px -1px rgb(28 25 23 / 0.05), 0 4px 8px -2px rgb(28 25 23 / 0.06)',
        lg: '0 4px 8px -2px rgb(28 25 23 / 0.05), 0 12px 20px -4px rgb(28 25 23 / 0.08)',
        xl: '0 8px 16px -4px rgb(28 25 23 / 0.06), 0 24px 40px -8px rgb(28 25 23 / 0.10)',
        '2xl': '0 32px 64px -16px rgb(28 25 23 / 0.18)',
        // A focus halo, not a glow: used only to show keyboard position.
        ring: '0 0 0 3px rgb(21 107 94 / 0.16)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Marks an agent that is still running. Brand teal, matching the
        // rest of the system — this was the last of the old sapphire.
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(30,123,107,0.40)' },
          '70%': { boxShadow: '0 0 0 8px rgba(30,123,107,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(30,123,107,0)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'draw-line': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'pulse-ring': 'pulse-ring 2s infinite',
        sweep: 'sweep 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'draw-line': 'draw-line 500ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
