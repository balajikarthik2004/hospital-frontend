import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cyan — bright enough to accent the navy chrome, deep enough at
        // 700 to carry text on white. Kept in step with --brand-* in index.css.
        primary: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        // The application chrome: sidebar ground in both themes.
        navy: {
          500: '#24405F',
          600: '#1B3350',
          700: '#142742',
          800: '#0E1C31',
          900: '#0A1424',
          950: '#060D18',
        },
        secondary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          300: '#A5B4FC',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        ink: {
          25: '#FCFDFE',
          50: '#F6F8FB',
          100: '#EEF2F7',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F1B2D',
          950: '#070C16',
        },
        // Agent identity colours (spec §1)
        clinical: '#0891B2',
        medication: '#7C3AED',
        followup: '#059669',
        education: '#D97706',
        orchestrator: '#4F46E5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Source Serif 4', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        '9.5': '2.375rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        md: '7px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        md: '0 2px 4px -2px rgb(16 24 40 / 0.06), 0 4px 8px -2px rgb(16 24 40 / 0.1)',
        lg: '0 4px 6px -2px rgb(16 24 40 / 0.03), 0 12px 16px -4px rgb(16 24 40 / 0.08)',
        xl: '0 8px 8px -4px rgb(16 24 40 / 0.03), 0 20px 24px -4px rgb(16 24 40 / 0.1)',
        glow: '0 0 0 4px rgb(15 117 133 / 0.12)',
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
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(15,117,133,0.35)' },
          '70%': { boxShadow: '0 0 0 8px rgba(15,117,133,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(15,117,133,0)' },
        },
        // Indeterminate bar for an agent that is mid-run.
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'draw-line': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'pulse-ring': 'pulse-ring 2s infinite',
        sweep: 'sweep 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'draw-line': 'draw-line 500ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
