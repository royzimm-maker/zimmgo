import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        sage: {
          50:  "#f8faf8",
          100: "#eef2ee",
          200: "#d5e0d5",
          300: "#afc5af",
          400: "#82a382",
          500: "#5e845e",
          600: "#4a6b4a",
          700: "#3d573d",
          800: "#334633",
          900: "#2b3a2b",
        },
        // New ZimmGo brand palette (logo teal/navy/orange) — scoped to the
        // logo and branding-branch work for now, not yet swapped in as the
        // site-wide brand/sage colors.
        teal: {
          50:  "#eaf6f5",
          100: "#cdebe8",
          200: "#9bd6d1",
          300: "#69c2ba",
          400: "#3aaca3",
          500: "#17958c",
          600: "#12786f",
          700: "#0f5d57",
          800: "#0b4541",
          900: "#082f2c",
        },
        navy: {
          50:  "#eef1f5",
          100: "#d6dce6",
          200: "#abb8cc",
          300: "#7e8faf",
          400: "#566b92",
          500: "#354d77",
          600: "#263c63",
          700: "#1b2c4c",
          800: "#142239",
          900: "#0e1728",
        },
        sunset: {
          50:  "#fdf3e9",
          100: "#fbe3c8",
          200: "#f7c68f",
          300: "#f3a85c",
          400: "#f09a44",
          500: "#ee8c33",
          600: "#d97321",
          700: "#b25a18",
          800: "#8a4413",
          900: "#63300d",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      animation: {
        "progress-fill": "progress-fill 0.6s ease-out forwards",
        "slide-in": "slide-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
      },
      keyframes: {
        "progress-fill": {
          from: { width: "0%" },
          to: { width: "var(--progress-width)" },
        },
        "slide-in": {
          from: { transform: "translateX(-12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "fade-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
