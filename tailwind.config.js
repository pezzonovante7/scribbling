/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        blush: 'var(--blush)',
        peach: {
          DEFAULT: 'var(--peach)',
          soft: 'var(--peach-soft)',
        },
        line: 'var(--line)',
        cocoa: {
          DEFAULT: 'var(--cocoa)',
          soft: 'var(--cocoa-soft)',
        },
        coral: {
          DEFAULT: 'var(--coral)',
          deep: 'var(--coral-deep)',
        },
        ember: 'var(--ember)',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(61, 40, 32, 0.04), 0 4px 14px rgba(61, 40, 32, 0.06)',
        glow: '0 6px 24px rgba(232, 148, 131, 0.25)',
      },
    },
  },
  plugins: [],
};
