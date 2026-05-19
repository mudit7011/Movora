import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          border: 'var(--card-border)',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(to right, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.8) 30%, rgba(10,10,10,0.4) 60%, transparent 100%)',
        'hero-gradient-bottom': 'linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.8) 20%, transparent 50%)',
        'card-fade': 'linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.6) 40%, transparent 100%)',
        'glow-radial': 'radial-gradient(ellipse at center, var(--primary-glow) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px var(--primary-glow)',
        'glow-md': '0 0 30px var(--primary-glow)',
        'glow-lg': '0 0 50px var(--primary-glow), 0 0 100px rgba(6, 214, 224, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 214, 224, 0.15)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}

export default config
