"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "@/components/icons";

const BOOT_LINES = [
  "linking wallet · Arc testnet",
  "loading budget policy · $0.05 cap",
  "warming VoI scorer · relevance × novelty",
  "x402 handshake ready",
];

/**
 * Cinematic boot sequence shown when the user enters the console from the
 * landing page. Runs once per browser session, then gets out of the way.
 */
export function IntroOverlay() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("assay-intro-seen")) return;
    setShow(true);
    const t = setTimeout(() => {
      sessionStorage.setItem("assay-intro-seen", "1");
      setDone(true);
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  const skip = () => {
    sessionStorage.setItem("assay-intro-seen", "1");
    setDone(true);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="intro"
          onClick={skip}
          className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-ink"
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-[120px]" />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            <div className="intro-logo">
              <LogoMark className="h-16 w-16" />
            </div>
            <div className="intro-logo font-display text-2xl font-bold tracking-tight text-white">
              Assay<span className="text-brand2"> Console</span>
            </div>

            <div className="flex w-64 flex-col gap-1.5 font-mono text-[11px] text-zinc-500">
              {BOOT_LINES.map((line, i) => (
                <div
                  key={line}
                  className="intro-line flex items-center gap-2"
                  style={{ animationDelay: `${0.5 + i * 0.4}s` }}
                >
                  <span className="text-buy">✓</span>
                  {line}
                </div>
              ))}
            </div>

            <div className="h-0.5 w-64 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand2"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.3, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
