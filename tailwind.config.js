/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1B19',
        cream: '#FAF7F0',
        parchment: '#F1EAD9',
        spine: '#0F1115',
        spineLight: '#171A21',
        gold: '#E8A33D',
        goldDeep: '#C97F1E',
        sage: '#3F7D58',
        ash: '#7A766D',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
