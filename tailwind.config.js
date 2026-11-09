/** @type {import('tailwindcss').Config} */
const scale = (prefix) => ({
  50: `rgb(var(--${prefix}-50) / <alpha-value>)`,
  100: `rgb(var(--${prefix}-100) / <alpha-value>)`,
  200: `rgb(var(--${prefix}-200) / <alpha-value>)`,
  300: `rgb(var(--${prefix}-300) / <alpha-value>)`,
  400: `rgb(var(--${prefix}-400) / <alpha-value>)`,
  500: `rgb(var(--${prefix}-500) / <alpha-value>)`,
  600: `rgb(var(--${prefix}-600) / <alpha-value>)`,
  700: `rgb(var(--${prefix}-700) / <alpha-value>)`,
  800: `rgb(var(--${prefix}-800) / <alpha-value>)`,
  900: `rgb(var(--${prefix}-900) / <alpha-value>)`,
  950: `rgb(var(--${prefix}-950) / <alpha-value>)`,
});

module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        slate: scale('slate'),
        primary: scale('primary'),
        manga: scale('manga'),
        book: scale('book'),
        media: scale('media'),
        'book-alt': 'rgb(var(--book-alt) / <alpha-value>)',
      }
    },
  },
  plugins: [],
};
