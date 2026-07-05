"use client";

import { motion } from "framer-motion";
import type { DecisionEvent } from "@/lib/useAgentRun";
import { fmtUsd } from "@/lib/api";

const STYLES: Record<
  string,
  { ring: string; glow: string; pill: string; label: string; icon: string; bar: string }
> = {
  BUY: {
    ring: "border-buy/50",
    glow: "hover:shadow-glow-buy",
    pill: "bg-buy/20 text-buy",
    label: "BOUGHT",
    icon: "✓",
    bar: "from-buy to-emerald-300",
  },
  SKIP: {
    ring: "border-skip/40",
    glow: "hover:shadow-glow-skip",
    pill: "bg-skip/20 text-skip",
    label: "REFUSED",
    icon: "✕",
    bar: "from-skip to-rose-300",
  },
  CACHE: {
    ring: "border-cache/40",
    glow: "hover:shadow-glow",
    pill: "bg-cache/20 text-cache",
    label: "CACHE-HIT",
    icon: "♻",
    bar: "from-cache to-sky-300",
  },
};

function Bar({ label, value, tint }: { label: string; value: number; tint: string }) {
  const pct = Math.max(2, Math.min(100, value * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[9px] uppercase tracking-wide text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${tint}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className="w-9 text-right text-[9px] tabular-nums text-gray-400">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

export function AssayCard({ d, index = 0 }: { d: DecisionEvent; index?: number }) {
  const st = STYLES[d.decision] ?? STYLES.SKIP;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-2xl border bg-panel/60 p-4 backdrop-blur-xl transition-shadow ${st.ring} ${st.glow}`}
    >
      {/* corner accent */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${st.bar} opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-20`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{d.title}</div>
          <div className="text-xs text-gray-500">
            {d.creator || "unknown creator"} · <span className="text-gray-400">{fmtUsd(d.price)}</span>
          </div>
        </div>
        <span className={`pill ${st.pill} shrink-0`}>
          {st.icon} {st.label}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-300">{d.rationale}</p>

      <div className="mt-3 grid gap-1.5">
        <Bar label="relevance" value={d.relevance} tint={st.bar} />
        <Bar label="novelty" value={d.novelty} tint={st.bar} />
        <Bar label="gain" value={d.expectedGain} tint={st.bar} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-edge/60 pt-2 text-[10px]">
        <span className="text-gray-500">
          reason <span className="text-gray-400">{d.reason}</span>
        </span>
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-semibold text-accent">
          VoI {d.voi}/$
        </span>
      </div>
    </motion.div>
  );
}
