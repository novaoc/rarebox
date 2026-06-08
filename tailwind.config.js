/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'rb': {
          'bg': '#0d1117',
          'surface': '#161b22',
          'card': '#21262d',
          'hover': '#2d333b',
          'border': '#30363d',
          'text': '#e6edf3',
          'text-secondary': '#8b949e',
          'text-muted': '#484f58',
          'accent': '#f5a623',
          'accent-dim': 'rgba(245, 166, 35, 0.12)',
          'success': '#3fb950',
          'success-dim': 'rgba(63, 185, 80, 0.12)',
          'danger': '#f85149',
          'danger-dim': 'rgba(248, 81, 73, 0.12)',
          'info': '#58a6ff',
        }
      }
    },
  },
  plugins: [],
}
