import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fb",
          400: "#36abf6",
          500: "#0d90e7",
          600: "#0172c4",
          700: "#015ba0",
          800: "#054e84",
          900: "#0a426e",
        },
      },
    },
  },
  plugins: [],
};
export default config;
