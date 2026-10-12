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
          teal: "rgb(var(--c-accent-dim) / <alpha-value>)",
          amber: "#F59E0B",
          red: "#EF4444",
          emerald: "#10B981",
        },
        slate: {
          50: "rgb(var(--c-text-100) / <alpha-value>)",
          100: "rgb(var(--c-text-100) / <alpha-value>)",
          200: "rgb(var(--c-text-200) / <alpha-value>)",
          300: "rgb(var(--c-text-300) / <alpha-value>)",
          400: "rgb(var(--c-text-400) / <alpha-value>)",
          500: "rgb(var(--c-text-500) / <alpha-value>)",
          600: "rgb(var(--c-border-strong) / <alpha-value>)",
          700: "rgb(var(--c-border) / <alpha-value>)",
          800: "rgb(var(--c-hover) / <alpha-value>)",
          900: "rgb(var(--c-surface) / <alpha-value>)",
          950: "rgb(var(--c-canvas) / <alpha-value>)",
        },
        teal: {
          950: "rgb(var(--c-surface) / <alpha-value>)",
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
