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
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#ff8533",
          500: "#ff6b00",
          600: "#e05e00",
          700: "#b84d00",
          800: "#963d00",
          900: "#7a3000",
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
        "fade-in":    "fadeIn 0.25s ease forwards",
        "slide-up":   "slideUp 0.3s ease forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer:      "shimmer 1.6s infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
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
