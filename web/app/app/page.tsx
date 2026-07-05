"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAgentRun } from "@/lib/useAgentRun";
import { AssayCard } from "@/components/AssayCard";
import { ActivityLog } from "@/components/ActivityLog";
import { BudgetGauge } from "@/components/BudgetGauge";
import { PhaseRail, type Phase } from "@/components/PhaseRail";
import { Receipt } from "@/components/Receipt";
import { Odometer } from "@/components/Odometer";
import { fmtUsd, registerAuthorization } from "@/lib/api";
import { authorizeSpending, type SpendingAuthorization } from "@/lib/wallet";



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

  // Buyer-side spending authorization. The user connects their wallet and signs a
  // spending cap once; the agent then spends autonomously within it — no per-purchase
  // popups. A run may never spend more than the signed cap.
  const [auth, setAuth] = useState<SpendingAuthorization | null>(null);
  // Backend-issued mandate id for this authorization. Every /pay/settle in the run
  // must carry it, and the signed cap is enforced server-side against it.
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);


  // The effective budget can never exceed what the wallet authorized this session.
  const cap = auth?.capUsdc ?? 0;
  const effectiveBudget = auth ? Math.min(budget, cap) : budget;
  const capExpired = auth ? auth.expiry * 1000 < Date.now() : false;
  const canRun = !!auth && !capExpired && !state.running && !!prompt.trim();

  const authorize = async () => {
    setAuthError(null);
    setAuthorizing(true);
    try {
      // Sign for at least the current budget so the run isn't clamped below intent.
      const grant = await authorizeSpending(Math.max(budget, 0.001));
      // Register the signed mandate with the backend, which verifies the EIP-712
      // signature and returns the mandate id the run must carry on every settlement.
      const registered = await registerAuthorization({
        user: grant.address,
        token: grant.token,
        cap: grant.capUnits,
        nonce: grant.nonce,
        expiry: grant.expiry,
        signature: grant.signature,
      });
      setAuth(grant);
      setAuthorizationId(registered.id);
    } catch (e: any) {

      if (e?.code === 4001) {
        setAuthError("Signature rejected — spending not authorized.");
      } else {
        setAuthError(e?.message ?? "Failed to authorize spending.");
      }
    } finally {
      setAuthorizing(false);
    }
  };


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
                max={auth ? cap : undefined}
                className="w-24 bg-transparent px-1 py-2 text-sm text-white outline-none"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              />
              <span className="pr-1 text-[10px] text-gray-600">USDC</span>
            </div>
          </div>

          {/* Spending authorization: connect wallet + sign a cap once, then the
              agent spends within it autonomously. */}
          {!auth ? (
            <button
              className="btn"
              disabled={authorizing || !prompt.trim()}
              onClick={authorize}
            >
              {authorizing ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Awaiting signature…
                </>
              ) : (
                <>🔑 Connect wallet + approve cap</>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-buy/40 bg-buy/5 px-3 py-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-buy" />
              <span className="text-gray-300">
                {auth.address.slice(0, 6)}…{auth.address.slice(-4)} authorized
              </span>
              <span className="font-semibold text-buy">
                cap {fmtUsd(cap)}
              </span>
              <button
                className="text-gray-500 underline-offset-2 hover:text-white hover:underline"
                onClick={() => {
                  setAuth(null);
                  setAuthorizationId(null);
                }}
              >
                revoke

              </button>
            </div>
          )}

          <button
            className="btn ml-auto"
            disabled={!canRun}
            title={
              !auth
                ? "Approve a spending cap first"
                : capExpired
                  ? "Authorization expired — re-approve"
                  : undefined
            }
            onClick={() =>
              run(prompt.trim(), effectiveBudget, authorizationId ?? undefined)
            }

          >
            {state.running ? "Assaying…" : "▶ Run agent"}
          </button>
          {hasRun && !state.running && (
            <button className="btn-ghost" onClick={reset}>
              Reset
            </button>
          )}
        </div>

        {auth && budget > cap && (
          <p className="text-xs text-amber-300/90">
            Budget exceeds your signed cap — the agent is limited to{" "}
            {fmtUsd(cap)} this run. Approve a higher cap to spend more.
          </p>
        )}
        {capExpired && (
          <p className="text-xs text-amber-300/90">
            Your spending authorization expired. Approve a new cap to run again.
          </p>
        )}
        {authError && (
          <p className="text-xs text-skip">{authError}</p>
        )}
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
            <WorkingPanel discovered={state.discovered} />
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

const WORK_STEPS = [
  "fetching candidate manifests from registry",
  "embedding task prompt · 384-dim vector",
  "scoring relevance × novelty per source",
  "checking overlap against owned sources",
  "pricing value-of-information vs. budget",
];

/** Compact "the agent is actually doing work" indicator shown before the
 *  first decision streams in. Steps tick off sequentially; a scanline sweeps
 *  the panel to sell the feeling of live computation. */
function WorkingPanel({ discovered }: { discovered: number }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, WORK_STEPS.length - 1)),
      1100,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass relative overflow-hidden p-5"
    >
      {/* sweeping scanline */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-accent/[0.07] to-transparent"
        initial={{ top: "-25%" }}
        animate={{ top: "115%" }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center gap-3">
        <span className="relative grid h-8 w-8 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </span>
        <div>
          <div className="text-sm font-semibold text-white">
            Assaying candidates…
          </div>
          <div className="text-[11px] text-gray-500">
            {discovered > 0
              ? `${discovered} source(s) under evaluation`
              : "discovering paid sources"}
          </div>
        </div>
      </div>

      <div className="relative mt-4 space-y-1.5 font-mono text-[11px]">
        {WORK_STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 transition-colors duration-300 ${
              i < step
                ? "text-gray-500"
                : i === step
                  ? "text-gray-200"
                  : "text-gray-700"
            }`}
          >
            {i < step ? (
              <span className="text-buy">✓</span>
            ) : i === step ? (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-edge" />
            )}
            {s}
            {i === step && <span className="animate-pulse text-accent">▍</span>}
          </div>
        ))}
      </div>

      {/* indeterminate progress */}
      <div className="relative mt-4 h-0.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="absolute h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent"
          initial={{ left: "-35%" }}
          animate={{ left: "105%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
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
