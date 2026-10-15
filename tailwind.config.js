/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#007bff',
          'blue-hover': '#0056b3',
          green: '#28a745',
          'green-hover': '#218838',
          yellow: '#ffc107',
          'yellow-hover': '#e0a800',
          info: '#17a2b8',
          'info-hover': '#117a8b',
          gray: '#6c757d',
          'gray-hover': '#5a6268',
          purple: '#800080',
        },
        semantic: {
          modified: '#ffeb3b',
          moved: '#ffe6e6',
          updated: '#d4edda',
          inactive: '#ffcdd2',
          noteMoved: '#d9534f',
          noteMerged: '#800080'
        }
      },
      fontFamily: {
        sans: ['Arial', 'Tahoma', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
