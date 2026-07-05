"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  getDecisions,
  getDiscover,
  fmtUsd,
  type Decision,
  type SourceCard,
} from "@/lib/api";

/**
 * The "Wall of No" — the emotional differentiator. Most demos brag about what
 * an agent buys. Assay brags about what it *refuses*, and shows the reasoning.
 * Each refusal is a tile with the rationale and the metrics that killed it.
 */
export default function RefusalsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sources, setSources] = useState<SourceCard[]>([]);
  const [sort, setSort] = useState<"recent" | "voi" | "novelty">("recent");

  useEffect(() => {
    const load = () => {
      getDecisions().then(setDecisions).catch(() => {});
      getDiscover("").then(setSources).catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const srcMap = useMemo(() => {
    const m = new Map<string, SourceCard>();
    sources.forEach((s) => m.set(s.id, s));
    return m;
  }, [sources]);

  const skips = useMemo(() => {
    let list = decisions.filter((d) => d.decision === "SKIP");
    if (sort === "voi") list = list.slice().sort((a, b) => a.voi - b.voi);
    else if (sort === "novelty")
      list = list.slice().sort((a, b) => a.novelty - b.novelty);
    else list = list.slice().reverse();
    return list;
  }, [decisions, sort]);

  const refusalRate = decisions.length
    ? skips.length / decisions.length
    : 0;

  return (
    <div className="space-y-8">
      {/* HERO */}
      <header className="relative overflow-hidden rounded-3xl border border-skip/30 bg-panel/40 px-6 py-10 backdrop-blur-xl sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-skip/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="pill mb-4 border border-skip/40 bg-skip/10 text-skip">
            the anti-hype feature
          </span>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            The <span className="text-skip">Wall of No.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
            Any agent can spend money. Trust comes from what it{" "}
            <span className="text-white">refuses</span> to buy. Here is every
            source Assay looked at, judged, and declined — with the exact
            reasoning and the metrics that sealed its fate.
          </p>
        </div>
      </header>

      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Refusals" value={String(skips.length)} tint="text-skip" />
        <Mini
          label="Refusal rate"
          value={`${Math.round(refusalRate * 100)}%`}
          tint="text-skip"
        />
        <Mini
          label="Decisions seen"
          value={String(decisions.length)}
          tint="text-white"
        />
        <Mini
          label="Money not wasted"
          value={fmtUsd(
            skips.reduce((a, d) => a + (d.price || 0), 0),
          )}
          tint="text-buy"
        />
      </div>

      {/* controls */}
      <div className="flex items-center justify-between">
        <h2 className="section-title">Declined sources</h2>
        <div className="flex gap-1">
          {(["recent", "voi", "novelty"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                sort === s
                  ? "bg-skip/20 text-skip"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {s === "voi" ? "Lowest VoI" : s === "novelty" ? "Least novel" : "Recent"}
            </button>
          ))}
        </div>
      </div>

      {skips.length === 0 && (
        <div className="glass grid place-items-center py-16 text-center">
          <div className="text-3xl">🛑</div>
          <p className="mt-2 max-w-xs text-sm text-gray-500">
            No refusals logged yet. Run the agent — it will decline the sources
            not worth your budget, and they will appear here.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skips.map((d, i) => {
          const src = srcMap.get(d.sourceId);
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
              className="group relative overflow-hidden rounded-2xl border border-skip/25 bg-panel/50 p-4 backdrop-blur-xl transition-shadow hover:shadow-glow-skip"
            >
              <div className="absolute -right-6 -top-6 select-none text-7xl font-black text-skip/[0.06] transition-transform group-hover:scale-110">
                NO
              </div>
              <div className="relative">
                <div className="truncate text-sm font-semibold text-white">
                  {src?.title ?? d.sourceId.slice(0, 12)}
                </div>
                <div className="text-xs text-gray-500">
                  {src?.creator?.name ?? "creator"} · {fmtUsd(d.price)}
                </div>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-gray-300">
                  “{d.rationale}”
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <Tag label="VoI" value={d.voi.toFixed(1)} />
                  <Tag label="rel" value={d.relevance.toFixed(2)} />
                  <Tag label="nov" value={d.novelty.toFixed(2)} />
                  <Tag label="gain" value={d.expectedGain.toFixed(2)} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="metric">
      <span className={`metric-value ${tint}`}>{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-gray-400">
      {label} <span className="tabular-nums text-gray-200">{value}</span>
    </span>
  );
}
