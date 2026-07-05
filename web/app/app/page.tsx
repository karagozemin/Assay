"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAgentRun } from "@/lib/useAgentRun";
import { AssayCard } from "@/components/AssayCard";
import { ActivityLog } from "@/components/ActivityLog";
import { BudgetGauge } from "@/components/BudgetGauge";
import { PhaseRail, type Phase } from "@/components/PhaseRail";
import { Receipt } from "@/components/Receipt";
import { Odometer } from "@/components/Odometer";
import { fmtUsd } from "@/lib/api";

const EXAMPLES = [
  "How do Circle Gateway nanopayments settle on Arc testnet?",
  "Tradeoffs of x402 vs. traditional API keys for paid content?",
  "Best practices for value-of-information budgeting in agents.",
];

type Filter = "ALL" | "BUY" | "SKIP" | "CACHE";

export default function AgentRunPage() {
  const { state, run, reset } = useAgentRun();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [budget, setBudget] = useState(0.02);
  const [filter, setFilter] = useState<Filter>("ALL");

  const bought = state.decisions.filter((d) => d.decision === "BUY");
  const skipped = state.decisions.filter((d) => d.decision === "SKIP");
  const cached = state.decisions.filter((d) => d.decision === "CACHE");

  const spent = useMemo(
    () => state.payments.reduce((a, p) => a + (p.amount ?? 0), 0),
    [state.payments],
  );

  // Derive the current phase from stream state for the PhaseRail.
  const phase: Phase = useMemo(() => {
    if (state.synth) return "done";
    if (state.payments.length > 0) return "settle";
    if (state.decisions.length > 0) return "assay";
    if (state.discovered > 0) return "discover";
    if (state.running) return "intake";
    return "idle";
  }, [state]);

  const visible = state.decisions.filter((d) =>
    filter === "ALL" ? true : d.decision === filter,
  );

  const hasRun = state.running || state.decisions.length > 0 || !!state.synth;

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------- HERO --------- */}
      <header className="relative overflow-hidden rounded-3xl border border-edge/70 bg-panel/40 px-6 py-10 backdrop-blur-xl sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent2/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="pill mb-4 border border-edge bg-white/5 text-gray-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buy" />
            live on Arc testnet · x402 nanopayments
          </span>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
            The spending brain
            <br />
            for <span className="text-gradient">research agents.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
            Give it a question and a budget. Watch it{" "}
            <span className="text-buy">buy the sources worth paying for</span> —
            and, just as importantly,{" "}
            <span className="text-skip">refuse the rest, with receipts</span>.
            Every cent settles to a real creator wallet.
          </p>
        </div>
      </header>

      {/* -------------------------------------------------- CONTROLS ------- */}
      <div className="glass space-y-4 p-5">
        <textarea
          className="input min-h-[64px] resize-y text-base"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent anything worth researching…"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-gray-400 transition hover:border-accent hover:text-white"
            >
              {ex.length > 46 ? ex.slice(0, 46) + "…" : ex}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wide text-gray-500">
              Budget
            </label>
            <div className="flex items-center rounded-xl border border-edge bg-ink/60 px-2">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="w-24 bg-transparent px-1 py-2 text-sm text-white outline-none"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              />
              <span className="pr-1 text-[10px] text-gray-600">USDC</span>
            </div>
          </div>
          <button
            className="btn ml-auto"
            disabled={state.running || !prompt.trim()}
            onClick={() => run(prompt.trim(), budget)}
          >
            {state.running ? "Assaying…" : "▶ Run agent"}
          </button>
          {hasRun && !state.running && (
            <button className="btn-ghost" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </div>

      {state.error && (
        <div className="rounded-2xl border border-skip/50 bg-skip/5 p-4 text-sm text-skip">
          {state.error}
        </div>
      )}

      {/* --------------------------------------------------- PHASE RAIL ---- */}
      {hasRun && <PhaseRail phase={phase} />}

      {/* ------------------------------------------------------ STATS ------ */}
      {hasRun && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="metric col-span-2 row-span-2 items-center justify-center sm:col-span-1 lg:col-span-1">
            <BudgetGauge spent={spent} budget={budget} />
          </div>
          <StatTile label="Discovered" value={state.discovered} tint="text-white" />
          <StatTile label="Bought" value={bought.length} tint="text-buy" />
          <StatTile label="Refused" value={skipped.length} tint="text-skip" />
          <StatTile label="Cache hits" value={cached.length} tint="text-cache" />
        </div>
      )}

      {/* ------------------------------------------------------- GRID ------ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Decision feed */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Assay decisions</h2>
            {state.decisions.length > 0 && (
              <div className="flex gap-1">
                {(["ALL", "BUY", "SKIP", "CACHE"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                      filter === f
                        ? "bg-accent/20 text-accent"
                        : "text-gray-500 hover:text-white"
                    }`}
                  >
                    {f === "SKIP" ? "Refused" : f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {state.decisions.length === 0 && !state.running && (
            <div className="glass grid place-items-center py-16 text-center">
              <div className="text-3xl">🧪</div>
              <p className="mt-2 max-w-xs text-sm text-gray-500">
                Decisions stream here as the agent assays each candidate source.
              </p>
            </div>
          )}

          {state.running && state.decisions.length === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded-2xl border border-edge/60 shimmer" />
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visible.map((d, i) => (
                <AssayCard key={d.sourceId} d={d} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Right rail */}
        <aside className="space-y-4">
          <h2 className="section-title">Live activity</h2>
          <ActivityLog log={state.log} running={state.running} />

          <AnimatePresence>
            {state.synth && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <h2 className="section-title">Proof of spend</h2>
                <Receipt
                  synth={state.synth}
                  payments={state.payments}
                  taskId={state.taskId}
                />

                <h2 className="section-title">Synthesized answer</h2>
                <div className="glass p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-buy">
                    <span className="rounded-md bg-buy/15 px-1.5 py-0.5 font-semibold">
                      {fmtUsd(state.synth.cost)}
                    </span>
                    <span className="text-gray-500">
                      → {state.synth.creatorsPaid} creator(s)
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-200">
                    {state.synth.answer}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="metric">
      <Odometer value={value} className={`metric-value ${tint}`} />
      <span className="metric-label">{label}</span>
    </div>
  );
}
