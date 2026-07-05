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
        // surfaces
        ink: "#060609",
        surface: "#0b0b10",
        raise: "#111118",
        raise2: "#16161f",
        edge: "#1e1e29",
        edge2: "#2a2a38",
        // legacy aliases (kept so nothing breaks)
        panel: "#0b0b10",
        panel2: "#111118",
        // brand
        brand: "#8b7cf8",
        brand2: "#c4b5fd",
        accent: "#8b7cf8",
        accent2: "#a78bfa",
        // semantics
        buy: "#34d399",
        skip: "#fb7185",
        cache: "#38bdf8",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,124,248,.25), 0 0 48px -12px rgba(139,124,248,.5)",
        "glow-buy": "0 0 0 1px rgba(52,211,153,.28), 0 0 40px -10px rgba(52,211,153,.45)",
        "glow-skip": "0 0 0 1px rgba(251,113,133,.28), 0 0 40px -10px rgba(251,113,133,.4)",
        card: "0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 40px -24px rgba(0,0,0,.7)",
        cta: "0 1px 0 0 rgba(255,255,255,.25) inset, 0 10px 30px -8px rgba(139,124,248,.65)",
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
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        gridPan: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 -44px" },
        },
        blink: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        auroraA: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(6%,4%) scale(1.15)" },
        },
        auroraB: {
          "0%,100%": { transform: "translate(0,0) scale(1.1)" },
          "50%": { transform: "translate(-5%,-6%) scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        blink: "blink 1.1s step-end infinite",
        auroraA: "auroraA 14s ease-in-out infinite",
        auroraB: "auroraB 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
