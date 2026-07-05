"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * Full-screen celebratory overlay shown the moment a source is published.
 * Expanding rings + a drawn-on checkmark + confetti shards + a glass receipt
 * card that rises into view. Auto-dismisses via the parent's timeout, or on
 * click anywhere.
 */
export interface PublishSuccessData {
  title: string;
  price: string;
  contentUrl?: string;
}

const SHARD_COLORS = ["#5ed2be", "#9d8ffa", "#7c6bf0", "#f0c56b", "#ffffff"];

// Pre-computed shard trajectories so the burst looks organic but is deterministic.
const SHARDS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 90 + (i % 3) * 34;
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist}px`,
    dr: `${(i % 2 ? 1 : -1) * (180 + i * 12)}deg`,
    color: SHARD_COLORS[i % SHARD_COLORS.length],
    delay: (i % 5) * 0.03,
  };
});

export default function PublishSuccess({
  data,
  onClose,
}: {
  data: PublishSuccessData | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          {/* dim + blur backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            className="medallion-pop relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-cache/25 bg-surface/80 p-8 text-center backdrop-blur-2xl"
            initial={{ y: 24, scale: 0.94 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{
              boxShadow:
                "0 30px 80px -20px rgba(94,210,190,0.35), inset 0 1px 0 0 rgba(255,255,255,0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* medallion with rings + confetti + checkmark */}
            <div className="relative h-24 w-24">
              <span className="publish-ring" />
              <span className="publish-ring" style={{ animationDelay: "0.45s" }} />
              <span className="publish-ring" style={{ animationDelay: "0.9s" }} />

              {SHARDS.map((s, i) => (
                <span
                  key={i}
                  className="confetti-shard"
                  style={
                    {
                      background: s.color,
                      "--dx": s.dx,
                      "--dy": s.dy,
                      "--dr": s.dr,
                      animationDelay: `${0.2 + s.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}

              <div
                className="absolute inset-0 flex items-center justify-center rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 50% 35%, rgba(94,210,190,0.35), rgba(94,210,190,0.08) 70%)",
                  border: "1px solid rgba(94,210,190,0.5)",
                }}
              >
                <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                  <path
                    className="check-path"
                    d="M13 24.5L20 31.5L34 16"
                    stroke="#5ed2be"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Source published</h3>
              <p className="text-sm text-zinc-400">
                <span className="text-cache">x402-protected</span> and live for agents to
                assay.
              </p>
            </div>

            {/* mini receipt */}
            <div className="w-full rounded-xl border border-edge bg-black/40 px-4 py-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-white">
                  “{data.title}”
                </span>
                <span className="shrink-0 rounded-md bg-cache/15 px-2 py-0.5 text-xs font-semibold text-cache">
                  {data.price}/use
                </span>
              </div>
              {data.contentUrl && (
                <p className="mt-1.5 truncate font-mono text-[11px] text-zinc-500">
                  {data.contentUrl}
                </p>
              )}
            </div>

            <button className="btn w-full" onClick={onClose}>
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
