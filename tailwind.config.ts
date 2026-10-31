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
        // Brand palette from heyjasminebrown.com: plum (#371b3a) primary,
        // peach-beige (#e7b696) accent, light beige (#ebeaeb) background.
        brand: {
          50: "#f5f1f5",
          100: "#e9e2ea",
          200: "#cfc3d0",
          300: "#a893aa",
          400: "#7a5e7d",
          500: "#523356",
          600: "#371b3a",
          700: "#2a142c",
          800: "#1f0f21",
          900: "#150a16",
        },
        peach: {
          DEFAULT: "#e7b696",
          light: "#f6e4d6",
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
        card: "0 1px 2px rgb(55 27 58 / 0.05), 0 10px 24px -14px rgb(55 27 58 / 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
