import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f172a', soft: '#334155', muted: '#64748b' },
        brand: { DEFAULT: '#1e3a5f', light: '#e8eef6' },
      },
    },
  },
  plugins: [],
}

export default config
