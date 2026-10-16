/** @type {import('tailwindcss').Config} */
const token = name => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        card: token('card'),
        ink: token('ink'),
        muted: token('muted'),
        edge: token('edge'),
        accent: token('accent'),
        'accent-fill': token('accent-fill'),
        win: token('win'),
        'win-fill': token('win-fill'),
        loss: token('loss'),
        'loss-fill': token('loss-fill'),
        gold: token('gold'),
        court: token('court'),
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'Impact', 'sans-serif'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}
