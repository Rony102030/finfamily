import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        cards: "var(--cards)",
        borders: "var(--borders)",
        brand: {
          green: "var(--brand-green)",
          blue: "var(--brand-blue)",
          purple: "var(--brand-purple)",
          yellow: "var(--brand-yellow)",
          red: "var(--brand-red)",
        }
      },
      fontFamily: {
        heading: ['var(--font-space)'],
        sans: ['var(--font-space)'],
      }
    },
  },
  plugins: [],
};
export default config;
