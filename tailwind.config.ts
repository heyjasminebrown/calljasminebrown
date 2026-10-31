import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm (stone-based) neutral scale instead of Tailwind's default
        // cool gray, so every existing bg-neutral-*/text-neutral-*/
        // border-neutral-* class picks up a softer, warmer tone app-wide.
        neutral: colors.stone,
        // Brand palette from heyjasminebrown.com: plum (#34223a) primary,
        // peach-beige (#e3b79c) accent, light beige (#ebeaeb) background.
        brand: {
          50: "#f4f1f5",
          100: "#e8e2ea",
          200: "#cdc3d0",
          300: "#a796ab",
          400: "#79657e",
          500: "#523e57",
          600: "#34223a",
          700: "#291a2e",
          800: "#1e1322",
          900: "#140c17",
        },
        peach: {
          DEFAULT: "#e3b79c",
          light: "#f5e6dc",
        },
        paper: "#ebeaeb",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      borderColor: {
        soft: "rgba(28,25,23,0.06)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(52 34 58 / 0.05), 0 10px 24px -14px rgb(52 34 58 / 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
