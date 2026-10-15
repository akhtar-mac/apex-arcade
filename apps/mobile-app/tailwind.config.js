/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#08090C',
        surface: '#111319',
        elevated: '#181B24',
        emerald: {
          DEFAULT: '#00F59B',
          glow: 'rgba(0, 245, 155, 0.2)',
          subtle: 'rgba(0, 245, 155, 0.08)'
        }
      }
    },
  },
  plugins: [],
}
