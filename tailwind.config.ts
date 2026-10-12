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
          DEFAULT: "rgb(var(--c-canvas) / <alpha-value>)",
          elevated: "rgb(var(--c-elevated) / <alpha-value>)",
          surface: "rgb(var(--c-surface) / <alpha-value>)",
          hover: "rgb(var(--c-hover) / <alpha-value>)",
          border: "rgb(var(--c-border) / <alpha-value>)",
          borderStrong: "rgb(var(--c-border-strong) / <alpha-value>)",
        },
        accent: {
          cyan: "rgb(var(--c-accent) / <alpha-value>)",
          cyanBright: "rgb(var(--c-accent-bright) / <alpha-value>)",
          teal: "rgb(var(--c-accent-Dim) / <alpha-value>)",
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
