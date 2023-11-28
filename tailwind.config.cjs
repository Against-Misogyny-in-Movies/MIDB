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
      },
      danger: {
        light: colors.red[300],
        DEFAULT: colors.red[500],
        dark: colors.red[700]
      },
      success: {
        light: colors.green[300],
        DEFAULT: colors.green[500],
        dark: colors.green[700]
      },
      warn: {
        light: colors.amber[300],
        DEFAULT: colors.amber[500],
        dark: colors.amber[700]
      },
      info: {
        light: colors.blue[300],
        DEFAULT: colors.blue[500],
        dark: colors.blue[700]
      },
    },
    'spacing': {
      0: '0',
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '2rem',
      xl: '3rem',
      '-xs': '-0.25rem',
      '-sm': '-0.5rem',
      '-md': '-1rem',
      '-lg': '-2rem',
      '-xl': '-3rem',
      auto: 'auto',
    },
    extend: {
     
    },
  },
  plugins: [],
}
