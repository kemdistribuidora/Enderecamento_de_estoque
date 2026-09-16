/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Barlow', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        concrete: {
          50: '#F5F4F0',
          100: '#EBEAE6',
          200: '#DEDCD5',
          300: '#C9C6BC',
        },
        steel: {
          900: '#20262A',
          800: '#2B3339',
          700: '#3B454C',
          600: '#545E64',
          400: '#8A949A',
          300: '#B7C0C4',
          100: '#E4E7E6',
        },
        ink: {
          900: '#1B1D1B',
          600: '#4B524E',
        },
        rust: {
          100: '#F3DCC9',
          600: '#C4501A',
          700: '#A63F13',
        },
        signal: {
          green100: '#DCEBDE',
          green600: '#3F7A52',
          amber100: '#F3E3C4',
          amber600: '#B8791E',
          red100: '#F3DAD3',
          red600: '#B33A2E',
        },
      },
      borderRadius: {
        tag: '4px',
        soft: '8px',
      },
    },
  },
  plugins: [],
};
