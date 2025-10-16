/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.{js,jsx,ts,tsx}",
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
