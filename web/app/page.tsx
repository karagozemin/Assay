"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  LogoMark,
  ArrowRightIcon,
  BoltIcon,
  BanIcon,
  CoinIcon,
  ShieldIcon,
  BrainIcon,
  ChainIcon,
  CacheIcon,
  CheckIcon,
  XIcon,
} from "@/components/icons";

/* ---------------------------------------------------------------- helpers */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------- hero demo widget */

const DEMO_STEPS = [
  {
    kind: "buy" as const,
    title: "L2 fee-market benchmarks, Q2",
    price: "$0.0030",
    note: "VoI 4.2 — high relevance, novel data. Paying.",
  },
  {
    kind: "skip" as const,
    title: "Intro to blockchain (2021)",
    price: "$0.0010",
    note: "Novelty 0.08 — already known. Refused.",
  },
  {
    kind: "buy" as const,
    title: "Arc sequencer latency traces",
    price: "$0.0045",
    note: "VoI 3.7 — fills evidence gap. Paying.",
  },
  {
    kind: "cache" as const,
    title: "USDC settlement deep-dive",
    price: "$0.0000",
    note: "Bought 2 tasks ago — reusing from cache.",
  },
  {
    kind: "skip" as const,
    title: "Generic market roundup",
    price: "$0.0025",
    note: "Relevance 0.31 — off-topic for task. Refused.",
  },
];

function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const [spent, setSpent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % DEMO_STEPS.length;
        if (next === 0) setSpent(0);
        else if (DEMO_STEPS[i].kind === "buy")
          setSpent((s) => s + parseFloat(DEMO_STEPS[i].price.slice(1)));
        return next;
      });
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border-beam relative rounded-3xl">
      <div className="glass relative overflow-hidden rounded-3xl p-5">
        {/* window chrome */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[10px] text-zinc-600">
            assay · live decision loop
          </span>
          <span className="flex items-center gap-1 rounded-full bg-buy/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-buy">
            <span className="h-1 w-1 animate-pulse rounded-full bg-buy" />
            running
          </span>
        </div>

        {/* budget bar */}
        <div className="mb-4">
          <div className="mb-1.5 flex justify-between font-mono text-[10px] text-zinc-500">
            <span>budget consumed</span>
            <span className="text-white">${spent.toFixed(4)} / $0.0500</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand2"
              animate={{ width: `${Math.min((spent / 0.05) * 100, 100)}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>

        {/* decision feed */}
        <div className="space-y-2">
          {DEMO_STEPS.map((s, i) => {
            const active = i === idx;
            const seen = i < idx;
            const tone =
              s.kind === "buy"
                ? "text-buy border-buy/30 bg-buy/10"
                : s.kind === "skip"
                  ? "text-skip border-skip/30 bg-skip/10"
                  : "text-cache border-cache/30 bg-cache/10";
            return (
              <motion.div
                key={s.title}
                animate={{
                  opacity: active ? 1 : seen ? 0.55 : 0.25,
                  scale: active ? 1 : 0.985,
                }}
                transition={{ duration: 0.4 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  active
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-transparent bg-white/[0.015]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${tone}`}
                >
                  {s.kind === "buy" ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : s.kind === "skip" ? (
                    <XIcon className="h-3 w-3" />
                  ) : (
                    <CacheIcon className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-200">
                    {s.title}
                  </div>
                  {active && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate text-[10px] text-zinc-500"
                    >
                      {s.note}
                    </motion.div>
                  )}
                </div>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    s.kind === "buy"
                      ? "text-buy"
                      : s.kind === "skip"
                        ? "text-zinc-600 line-through"
                        : "text-cache"
                  }`}
                >
                  {s.price}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

export default function LandingPage() {
  return (
    <div className="relative">
      {/* ── nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-ink/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight text-white">
              Assay
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a href="#pillars" className="transition hover:text-white">
              Why Assay
            </a>
            <a href="#stack" className="transition hover:text-white">
              Stack
            </a>
          </nav>
          <Link href="/app" className="btn !px-4 !py-2 text-xs">
            Launch Console
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── hero ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div>
          <Reveal>
            <span className="pill border border-brand/30 bg-brand/10 text-brand2">
              <BoltIcon className="h-3 w-3" />
              x402 micropayments · Arc testnet · real USDC
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              The spending brain
              <br />
              for <span className="text-gradient">research agents.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400">
              Assay gives an AI agent a budget and a conscience. It scores every
              paid source for value-of-information, buys only what moves the
              answer forward — and shows you exactly why it{" "}
              <span className="text-white">refused</span> the rest.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="btn">
                Enter the Console
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a href="#how" className="btn-ghost">
                See how it decides
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <div className="mt-10 flex items-center gap-6 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1.5">
                <ShieldIcon className="h-3.5 w-3.5 text-zinc-500" />
                Hard budget caps
              </span>
              <span className="flex items-center gap-1.5">
                <ChainIcon className="h-3.5 w-3.5 text-zinc-500" />
                On-chain settlement proofs
              </span>
              <span className="flex items-center gap-1.5">
                <BanIcon className="h-3.5 w-3.5 text-zinc-500" />
                Every refusal logged
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <HeroDemo />
        </Reveal>
      </section>

      {/* ── stats strip ─────────────────────────────────────── */}
      <section className="border-y border-white/[0.05] bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/[0.05] px-4 sm:grid-cols-4 sm:px-6">
          {[
            ["per-use", "pricing, no subscriptions"],
            ["<1¢", "typical price per source"],
            ["100%", "of refusals explained"],
            ["0", "wasted budget by design"],
          ].map(([v, l]) => (
            <div key={l} className="px-5 py-6">
              <div className="font-display text-2xl font-bold text-white">{v}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-600">
                {l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── how it works ────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <span className="section-title">How it works</span>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Four steps between a question and a receipt.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BrainIcon,
              step: "01",
              title: "Discover",
              body: "The agent reads free abstracts from creator sources — never the paywalled content.",
            },
            {
              icon: BoltIcon,
              step: "02",
              title: "Score",
              body: "Each source gets a value-of-information score: relevance × novelty × expected gain vs price.",
            },
            {
              icon: CoinIcon,
              step: "03",
              title: "Buy or refuse",
              body: "Worth it? A ~$0.003 USDC payment settles over x402 on Arc. Not worth it? Logged with a rationale.",
            },
            {
              icon: ShieldIcon,
              step: "04",
              title: "Prove",
              body: "Answers cite only paid sources. Every payment has an on-chain proof; every refusal an explanation.",
            },
          ].map(({ icon: Icon, step, title, body }, i) => (
            <Reveal key={step} delay={i * 0.08}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-brand/40">
                <div className="absolute -right-3 -top-5 select-none font-display text-[64px] font-bold text-white/[0.03] transition-colors group-hover:text-brand/[0.07]">
                  {step}
                </div>
                <div className="relative">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand2">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                    {body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── pillars ─────────────────────────────────────────── */}
      <section id="pillars" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <span className="section-title">Why Assay</span>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Any agent can spend money.
            <br />
            <span className="text-gradient">Trust comes from restraint.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Reveal delay={0}>
            <div className="glass h-full p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-skip/30 bg-skip/10 text-skip">
                <BanIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">
                The Wall of No
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Most demos brag about what an agent buys. Assay showcases what
                it refuses — every declined source, with the metrics and
                reasoning that killed it. That&apos;s the audit trail your budget
                deserves.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="glass h-full p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-buy/30 bg-buy/10 text-buy">
                <CoinIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">
                Creators get paid per use
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Publish a source behind an x402 endpoint, set a price, connect a
                wallet. When an agent decides your content is worth it, USDC
                lands directly — no subscriptions, no middlemen, no invoices.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="glass h-full p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cache/30 bg-cache/10 text-cache">
                <LedgerLikeIcon />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">
                The ledger doesn&apos;t lie
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Every payment carries a settlement proof on Arc testnet. Totals,
                per-creator payouts, buy/skip ratios — all live, all verifiable,
                all one click away in the console.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── stack ───────────────────────────────────────────── */}
      <section id="stack" className="border-y border-white/[0.05] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div>
                <span className="section-title">Built on</span>
                <h2 className="mt-2 font-display text-2xl font-bold text-white">
                  Real rails, not mocks.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  ["x402", "HTTP-native payments"],
                  ["USDC", "settlement currency"],
                  ["Arc", "testnet L1"],
                  ["LangGraph", "agent runtime"],
                ].map(([name, sub]) => (
                  <div
                    key={name}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="font-mono text-sm font-semibold text-white">
                      {name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                      {sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── final CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <Reveal>
          <div className="border-beam relative rounded-3xl">
            <div className="glass relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
              <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-brand/15 blur-[100px]" />
              <div className="relative">
                <LogoMark className="mx-auto h-12 w-12" />
                <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Watch an agent spend a nickel
                  <br />
                  like it&apos;s a million dollars.
                </h2>
                <p className="mx-auto mt-4 max-w-md text-sm text-zinc-500">
                  Give it a research task, a $0.05 budget, and watch every
                  buy, skip, and cache-hit happen live.
                </p>
                <Link href="/app" className="btn mt-8 !px-8 !py-3 !text-base">
                  Launch the Console
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-[12px] text-zinc-600 sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-5 w-5" />
            <span>Assay — the agent that knows when not to pay.</span>
          </div>
          <span className="font-mono">x402 · USDC · Arc testnet</span>
        </div>
      </footer>
    </div>
  );
}

function LedgerLikeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 8h7M8.5 12h7M8.5 16h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
