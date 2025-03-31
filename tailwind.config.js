/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}', './src/app.html'],
  darkMode: 'class', // Enable dark mode based on class
  theme: {
    fontFamily: {
      sans: ['Roboto', 'sans-serif'], // Use Roboto as the default sans-serif font
    },
    extend: {},
  },
  plugins: [],
}