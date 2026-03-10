/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["IBM Plex Mono", "Courier New", "monospace"],
      },
      colors: {
        navy: {
          950: "#060d1a",
          900: "#080f1e",
          800: "#0d1525",
          700: "#0f1f35",
          600: "#1a2744",
          500: "#1e2d45",
          400: "#2a4a8a",
        },
      },
    },
  },
  plugins: [],
};
