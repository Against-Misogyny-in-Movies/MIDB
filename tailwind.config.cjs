import colors from 'tailwindcss/colors.js';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		screens: {
			sm: '480px',
			md: '768px',
			lg: '976px',
			xl: '1440px'
		},
		colors: {
			primary: {
				light: colors.purple[300],
				DEFAULT: colors.purple[500],
				dark: colors.purple[700]
			},
			secondary: {
				light: '#E2E2D5',
				DEFAULT: '#888883',
				dark: '#55554E'
			},
			neutral: {
				light: colors.neutral[300],
				DEFAULT: colors.neutral[500],
				dark: colors.neutral[900]
			},
			white: colors.white,
			black: colors.black,
			gray: {
				light: colors.gray[100],
				DEFAULT: colors.gray[900],
				dark: colors.gray[950]
			},
			sky: {
				light: colors.sky[400],
				DEFAULT: colors.sky[600],
				dark: colors.sky[700]
			},
			pink: {
				light: colors.pink[400],
				DEFAULT: '#f72585',
				dark: colors.pink[600]
			},
			violet: {
				light: colors.violet[400],
				DEFAULT: colors.violet[500],
				dark: '#480ca8'
			},
			transparent: 'transparent'
		},
		spacing: {
			0: '0',
			xs: '0.25rem',
			sm: '0.5rem',
			md: '1rem',
			lg: '2rem',
			xl: '3rem',
			'2xl': '4rem',
			'3xl': '6rem',
			'4xl': '8rem',
			'5xl': '10rem',
			hero: '30rem'
		},
		extend: {}
	},
	plugins: []
};
