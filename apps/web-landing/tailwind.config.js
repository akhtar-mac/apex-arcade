/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arcade: {
          dark: '#080a0f',
          surface: '#0f1422',
          card: '#161d30',
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
