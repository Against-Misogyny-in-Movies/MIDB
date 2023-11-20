import colors from 'tailwindcss/colors.js';


/** @type {import('tailwindcss').Config} */
export default {

  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '976px',
      xl: '1440px',
    },
    colors: {
      'primary': {
        light: colors.purple[300],
        DEFAULT: colors.purple[500],
        dark: colors.purple[700]
      },
      'secondary': {
        light: '#E2E2D5',
        DEFAULT: '#888883',
        dark: '#55554E'
      },
      'neutral': {
        light: colors.zinc[300],
        DEFAULT: colors.zinc[500],
        dark: colors.zinc[700]
      },
      white: colors.white,
      black: colors.black,
      gray: {
        light: colors.slate[100],
        DEFAULT: colors.slate[500],
        dark: colors.slate[900]
      }
    },
    'spacing': {
      0: '0',
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '2rem',
      xl: '3rem',
    },
    extend: {
     
    },
  },
  plugins: [],
}
