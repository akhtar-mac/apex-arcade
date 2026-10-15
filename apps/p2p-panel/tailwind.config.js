/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        p2p: {
          bg: '#0b0f19',
          surface: '#111827',
          card: '#1a2234',
          accent: '#0df59d',
          gold: '#ffb800',
          cyan: '#00e5ff',
          red: '#ff3366'
        }
      }
    },
  },
  plugins: [],
}
