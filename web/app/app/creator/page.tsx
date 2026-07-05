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
import PublishSuccess, { type PublishSuccessData } from "@/components/PublishSuccess";
import { proveWalletControl } from "@/lib/wallet";



// Creators registered from *this* browser. Publishing is gated to these so you can
// only ever publish under an identity you created — you can't impersonate someone else.
const OWNED_KEY = "assay.ownedCreatorIds";
const loadOwnedIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OWNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};
const saveOwnedIds = (ids: string[]) => {
  try {
    window.localStorage.setItem(OWNED_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

export default function CreatorPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);


  // creator form
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [registering, setRegistering] = useState(false);


  // source form
  const [creatorId, setCreatorId] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [content, setContent] = useState("");
  const [price, setPrice] = useState(0.002);
  const [tags, setTags] = useState("");

  // publish flow
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState<PublishSuccessData | null>(null);


  const refresh = () => {
    getCreators().then(setCreators).catch(() => {});
    getPayouts().then(setPayouts).catch(() => {});
  };
  useEffect(() => {
    setOwnedIds(loadOwnedIds());
    refresh();
  }, []);

  // Only identities registered from this browser may publish — prevents impersonation.
  const ownedCreators = creators.filter((c) => ownedIds.includes(c.id));


  const onCreateCreator = async () => {
    setErr(null);
    setMsg(null);
    setRegistering(true);
    try {
      // Proof-of-control: connect the wallet, switch to Arc, and broadcast a tiny
      // self-transaction. The backend verifies this tx on-chain, so you can only
      // register a wallet you actually control.
      const { address, proofTx } = await proveWalletControl();
      const c = await createCreator(name.trim(), address, proofTx);
      // Remember this identity as owned by *this* browser so only it can publish under it.
      const nextOwned = Array.from(new Set([...ownedIds, c.id]));
      setOwnedIds(nextOwned);
      saveOwnedIds(nextOwned);
      setMsg(
        `Creator "${c.name}" registered — wallet ${c.walletAddress} verified on Arc (proof ${proofTx.slice(0, 10)}…).`,
      );
      setName("");
      setWallet("");
      setCreatorId(c.id);
      refresh();
    } catch (e: any) {
      // Wallet rejections come back with code 4001.
      if (e?.code === 4001) {
        setErr("Wallet request rejected — registration cancelled.");
      } else {
        setErr(e?.message ?? "Failed to create creator");
      }
    } finally {
      setRegistering(false);
    }
  };


  const onCreateSource = async () => {
    setErr(null);
    setMsg(null);
    setPublishing(true);
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
      setSuccess({
        title: s.title,
        price: fmtUsd(price),
        contentUrl: s.contentUrl,
      });
      setTitle("");
      setAbstract("");
      setContent("");
      setTags("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to publish source");
    } finally {
      setPublishing(false);
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
          <p className="text-xs text-gray-500">
            Your wallet address is read directly from your browser wallet — you'll
            approve a tiny self-transaction on Arc to prove you control it.
          </p>
          <button
            className="btn"
            disabled={!name.trim() || registering}
            onClick={onCreateCreator}
          >
            {registering ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                Awaiting wallet…
              </>
            ) : (
              <>Connect wallet + register</>
            )}
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
            {/* Only identities you registered in this browser — you can't publish as someone else. */}
            {ownedCreators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {ownedCreators.length === 0 && (
            <p className="text-xs text-gray-500">
              Register a creator above first — you can only publish under an identity
              you created in this browser.
            </p>
          )}

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
            disabled={
              publishing ||
              !creatorId ||
              !title.trim() ||
              !abstract.trim() ||
              !content.trim()
            }
            onClick={onCreateSource}
          >
            {publishing ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                Settling on-chain…
              </>
            ) : (
              <>Publish (price {fmtUsd(price)}/use)</>
            )}
          </button>
        </section>
      </div>

      <PublishSuccess data={success} onClose={() => setSuccess(null)} />


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
