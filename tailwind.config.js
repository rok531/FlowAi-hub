/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
      },
      boxShadow: {
        'glow-indigo': '0 0 40px rgba(79, 70, 229, 0.35)',
      },
    },
  },
  plugins: [],
};

