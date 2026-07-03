/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // สปอร์ต accent ไล่เฉดส้ม→แดง
        brand: {
          DEFAULT: '#ff5a1f',
          light: '#ff7a45',
          dark: '#e63a12',
        },
        // พื้นผิวกราไฟต์แบบ Tesla
        ink: {
          DEFAULT: '#08080a',
          950: '#0a0a0c',
          900: '#0f0f11',
          800: '#141416',
          700: '#1b1b1e',
          600: '#232327',
          500: '#2c2c31',
        },
        dim: '#8b8b90',
      },
      letterSpacing: {
        label: '0.12em',
      },
      boxShadow: {
        glow: '0 8px 30px -8px rgba(255,90,31,0.55)',
        card: '0 2px 24px -10px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
}
