/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#000000",
          900: "#080808",
          850: "#0d0d0d",
          800: "#111111",
          700: "#1a1a1a",
          600: "#222222",
          500: "#2b2b2b",
        },
        brand: {
          50:  "#fff0e6",
          100: "#ffd9b8",
          200: "#ffbf85",
          300: "#ffa552",
          400: "#ff8c20",
          500: "#ff6b00",
          600: "#e05c00",
          700: "#bf4e00",
          800: "#9e4000",
          900: "#7d3300",
        },
        accent: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },
      },
      fontFamily: {
        display: ["'Inter'", "system-ui", "sans-serif"],
        body:    ["'Inter'", "system-ui", "sans-serif"],
        mono:    ["'Courier New'", "monospace"],
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease forwards",
        "slide-up":   "slideUp 0.35s ease forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer:      "shimmer 1.6s infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        shimmer: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
