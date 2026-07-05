"use client";

import { useEffect, useState } from "react";
import {
  createCreator,
  createSource,
  getCreators,
  getPayouts,
  fmtUsd,
  type Creator,
  type Payout,
} from "@/lib/api";

export default function CreatorPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // creator form
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");

  // source form
  const [creatorId, setCreatorId] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [content, setContent] = useState("");
  const [price, setPrice] = useState(0.002);
  const [tags, setTags] = useState("");

  const refresh = () => {
    getCreators().then(setCreators).catch(() => {});
    getPayouts().then(setPayouts).catch(() => {});
  };
  useEffect(refresh, []);

  const onCreateCreator = async () => {
    setErr(null);
    setMsg(null);
    try {
      const c = await createCreator(name.trim(), wallet.trim());
      setMsg(`Creator "${c.name}" registered with wallet ${c.walletAddress}.`);
      setName("");
      setWallet("");
      setCreatorId(c.id);
      refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create creator");
    }
  };

  const onCreateSource = async () => {
    setErr(null);
    setMsg(null);
    try {
      const s = await createSource({
        creatorId,
        title: title.trim(),
        abstract: abstract.trim(),
        content: content.trim(),
        price,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setMsg(`Source "${s.title}" published — x402-protected at ${s.contentUrl}.`);
      setTitle("");
      setAbstract("");
      setContent("");
      setTags("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to publish source");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Creator</h1>
        <p className="text-sm text-gray-400">
          Register, connect a wallet, and publish a paid source. Each source is
          served behind an x402-protected endpoint; when an agent buys it, USDC
          lands directly in your wallet.
        </p>
      </header>

      {msg && (
        <div className="card border-emerald-500/50 bg-emerald-500/5 text-sm text-emerald-300">
          {msg}
        </div>
      )}
      {err && (
        <div className="card border-rose-500/50 bg-rose-500/5 text-sm text-rose-300">
          {err}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Register creator */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            1 · Register creator
          </h2>
          <input
            className="input"
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input font-mono"
            placeholder="Wallet address (0x…)"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
          <button
            className="btn"
            disabled={!name.trim() || !wallet.trim()}
            onClick={onCreateCreator}
          >
            Register + connect wallet
          </button>
        </section>

        {/* Publish source */}
        <section className="card space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            2 · Publish a source
          </h2>
          <select
            className="input"
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
          >
            <option value="">Select creator…</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input min-h-[60px]"
            placeholder="Abstract (public — shown at discovery, used for relevance)"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
          />
          <textarea
            className="input min-h-[80px]"
            placeholder="Full content (private — only served after payment)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex gap-3">
            <input
              className="input"
              placeholder="tags, comma, separated"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              className="input w-36"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button
            className="btn"
            disabled={!creatorId || !title.trim() || !abstract.trim() || !content.trim()}
            onClick={onCreateSource}
          >
            Publish (price {fmtUsd(price)}/use)
          </button>
        </section>
      </div>

      {/* Live earnings */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Live earnings
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Creator</th>
                <th className="pb-2">Wallet</th>
                <th className="pb-2 text-right">Paid calls</th>
                <th className="pb-2 text-right">Earned (USDC)</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    No payouts yet.
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.creatorId} className="border-t border-edge">
                  <td className="py-2 text-white">{p.name}</td>
                  <td className="py-2 font-mono text-xs text-gray-400">
                    {p.walletAddress.slice(0, 10)}…{p.walletAddress.slice(-4)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.paidCalls}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-300">
                    {fmtUsd(p.totalUsdc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
