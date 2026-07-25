/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Slightly cool-tinted dark palette (JetBrains/GitHub-Desktop-like)
        // — reads more premium than a pure neutral gray while remaining flat.
        'bg-primary':      '#161719',
        'bg-secondary':    '#1c1e21',
        'bg-tertiary':     '#22252a',
        'bg-elevated':     '#2a2d33',
        'border-color':    '#2b2f36',
        'border-strong':   '#3a3f47',
        'text-primary':    '#e6e8ec',
        'text-secondary':  '#9aa3af',
        'text-tertiary':   '#6b7280',
        'text-muted':      '#4b525c',
        'accent-primary':  '#3b82f6',
        'accent-strong':   '#2563eb',
        'accent-subtle':   'rgba(59, 130, 246, 0.14)',
      },
      fontFamily: {
        sans: [
          '"Inter Variable"', '"Inter"', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI Variable Text"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"', '"SF Mono"', '"Cascadia Code"',
          '"Roboto Mono"', 'Menlo', 'Consolas', 'monospace',
        ],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
      },
      boxShadow: {
        // Subtle only — no soft ambient/blur shadows anywhere.
        'card':    '0 1px 0 0 rgba(255, 255, 255, 0.02) inset',
        'sunken':  '0 1px 0 0 rgba(0, 0, 0, 0.35) inset',
      },
    },
  },
  plugins: [],
}
