import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07070c",
        panel: "#101019",
        panel2: "#15151f",
        edge: "#232333",
        buy: "#22c55e",
        skip: "#fb7185",
        cache: "#38bdf8",
        accent: "#a78bfa",
        accent2: "#818cf8",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["var(--font-display)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(167,139,250,.25), 0 0 40px -8px rgba(167,139,250,.45)",
        "glow-buy": "0 0 0 1px rgba(34,197,94,.3), 0 0 40px -8px rgba(34,197,94,.5)",
        "glow-skip": "0 0 0 1px rgba(251,113,133,.3), 0 0 40px -8px rgba(251,113,133,.45)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
