"use client";

import { useMemo, useState } from "react";
import { useAgentRun } from "@/lib/useAgentRun";
import { DecisionCard } from "@/components/DecisionCard";
import { fmtUsd } from "@/lib/api";

const EXAMPLES = [
  "How do Circle Gateway nanopayments settle on Arc testnet?",
  "What are the tradeoffs of x402 vs. traditional API keys for paid content?",
  "Summarize best practices for value-of-information budgeting in research agents.",
];

export default function AgentRunPage() {
  const { state, run } = useAgentRun();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [budget, setBudget] = useState(0.02);

  const bought = state.decisions.filter((d) => d.decision === "BUY");
  const skipped = state.decisions.filter((d) => d.decision === "SKIP");
  const cached = state.decisions.filter((d) => d.decision === "CACHE");

  const spent = useMemo(
    () => state.payments.reduce((a, p) => a + (p.amount ?? 0), 0),
    [state.payments],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Agent Run</h1>
        <p className="text-sm text-gray-400">
          Give the agent a question and a budget. Watch it decide which creator
          sources are worth buying — and, just as importantly,{" "}
          <span className="text-rose-300">why it refuses the rest</span>.
        </p>
      </header>

      {/* Controls */}
      <div className="card space-y-3">
        <textarea
          className="input min-h-[70px] resize-y"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a research question…"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-gray-300 hover:border-accent"
            >
              {ex.length > 48 ? ex.slice(0, 48) + "…" : ex}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Budget (USDC)</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            className="input w-32"
            value={budget}
            onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
          />
          <button
            className="btn"
            disabled={state.running || !prompt.trim()}
            onClick={() => run(prompt.trim(), budget)}
          >
            {state.running ? "Running…" : "Run agent"}
          </button>
        </div>
      </div>

      {state.error && (
        <div className="card border-rose-500/50 bg-rose-500/5 text-sm text-rose-300">
          {state.error}
        </div>
      )}

      {/* Live stat bar */}
      {(state.running || state.decisions.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Discovered" value={String(state.discovered)} />
          <Stat label="Bought" value={String(bought.length)} accent="text-emerald-300" />
          <Stat label="Skipped" value={String(skipped.length)} accent="text-rose-300" />
          <Stat label="Cache hits" value={String(cached.length)} accent="text-sky-300" />
          <Stat label="Spent" value={fmtUsd(spent)} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Decision feed — the money shot */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            ASSAY decisions
          </h2>
          {state.decisions.length === 0 && !state.running && (
            <p className="text-sm text-gray-500">
              Decisions will stream here as the agent assays each candidate.
            </p>
          )}
          {state.running && state.decisions.length === 0 && (
            <p className="animate-pulse text-sm text-gray-500">
              Discovering candidate sources…
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {state.decisions.map((d) => (
              <DecisionCard key={d.sourceId} d={d} />
            ))}
          </div>
        </section>

        {/* Right rail: activity log + answer */}
        <aside className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Activity
            </h2>
            <div className="card max-h-72 space-y-1 overflow-auto text-xs">
              {state.log.length === 0 && (
                <span className="text-gray-500">Idle.</span>
              )}
              {state.log.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span
                    className={
                      l.event === "error"
                        ? "text-rose-400"
                        : l.event === "pay"
                          ? "text-emerald-400"
                          : "text-gray-500"
                    }
                  >
                    [{l.event}]
                  </span>
                  <span className="text-gray-300">{l.text}</span>
                </div>
              ))}
            </div>
          </div>

          {state.synth && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Answer
              </h2>
              <div className="card space-y-3">
                <div className="text-sm text-emerald-300">
                  Cost {fmtUsd(state.synth.cost)} → {state.synth.creatorsPaid}{" "}
                  creator(s). {state.synth.bought} bought · {state.synth.skipped}{" "}
                  skipped · {state.synth.cached} cached.
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-200">
                  {state.synth.answer}
                </pre>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="metric">
      <span className={`metric-value ${accent}`}>{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
