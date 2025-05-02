/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",  // All JS/TS files in src directory
    "./public/index.html",         // Main HTML file
    "./index.html"                 // For Vite projects (root index.html)
  ],
  darkMode: "class", // Enable dark mode with class-based switching
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Calibri", "Carlito", "Liberation Sans", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleUp: {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        subtleFloat: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
          "100%": { transform: "translateY(0px)" },
        },
        subtlePulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(0, 112, 243, 0.1)" },
          "70%": { boxShadow: "0 0 0 10px rgba(0, 112, 243, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0, 112, 243, 0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease forwards",
        "scale-up": "scaleUp 0.3s ease forwards",
        float: "subtleFloat 3s ease-in-out infinite",
        "pulse-subtle": "subtlePulse 2s infinite",
      },
    },
  },
  plugins: [],
}