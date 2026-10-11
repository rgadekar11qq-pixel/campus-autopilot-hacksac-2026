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
        canvas: {
          DEFAULT: "#070A10",
          elevated: "#0D121C",
          surface: "#121926",
          hover: "#182132",
          border: "#1F2B3E",
          borderStrong: "#2E3F5B",
        },
        accent: {
          cyan: "#14B8A6",
          cyanBright: "#2DD4BF",
          teal: "#0D9488",
          amber: "#F59E0B",
          red: "#EF4444",
          emerald: "#10B981",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
