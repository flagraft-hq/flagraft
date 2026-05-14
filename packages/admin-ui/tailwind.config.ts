import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0eefe',
          200: '#bbdcfd',
          300: '#7fc1fc',
          400: '#3aa1f8',
          500: '#1186e9',
          600: '#0469c7',
          700: '#0554a1',
          800: '#094885',
          900: '#0d3d6e',
          DEFAULT: '#1186e9',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f7f9',
          subtle: '#eef0f3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
