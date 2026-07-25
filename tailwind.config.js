/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,jsx,ts,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#242424',
        'bg-tertiary': '#2a2a2a',
        'text-primary': '#e0e0e0',
        'text-secondary': '#a0a0a0',
        'text-tertiary': '#707070',
        'accent-primary': '#3b82f6',
        'accent-success': '#10b981',
        'accent-warning': '#f59e0b',
        'accent-error': '#ef4444',
        'border-color': '#333333',
      }
    },
  },
  plugins: [],
}
