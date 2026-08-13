/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0a0f1e",
          light: "#101830",
          border: "#1e2740",
          950: "#05070d",
          900: "#080b15",
          800: "#0d1220",
          700: "#141b2e",
          600: "#1d2740",
          500: "#2a3654",
        },
        teal: {
          DEFAULT: "#2a9d8f",
          dark: "#218074",
        },
        // Patient Nexus. Distinct from Intelligence's teal so the two
        // read as complementary rather than as the same tool twice.
        sage: {
          DEFAULT: "#7fa676",
          dark: "#5f8257",
        },
        gold: {
          DEFAULT: "#c8a24a",
          dark: "#a9873c",
          light: "#e2c383",
        },
        clinicalblue: {
          DEFAULT: "#3b6fd6",
          dark: "#2f57ab",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        plex: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      keyframes: {
        pulseDot: {
          "0%, 80%, 100%": { opacity: "0.3" },
          "40%": { opacity: "1" },
        },
        soundbar: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1.4)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s infinite ease-in-out both",
        soundbar: "soundbar 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
