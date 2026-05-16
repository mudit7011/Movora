import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0A0F',
        crimson: {
          DEFAULT: '#C41E3A',
          dark: '#9B162C',
          light: '#E02040',
        },
        gold: {
          DEFAULT: '#F5A623',
          light: '#F7B843',
        },
        muted: '#A1A1AA',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-bebas)', 'cursive'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(to right, rgba(10,10,15,0.95) 40%, rgba(10,10,15,0.4) 100%)',
        'card-fade': 'linear-gradient(to top, rgba(10,10,15,1) 0%, rgba(10,10,15,0) 60%)',
      },
      boxShadow: {
        'crimson-glow': '0 0 20px rgba(196,30,58,0.5)',
        'gold-glow': '0 0 15px rgba(245,166,35,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
