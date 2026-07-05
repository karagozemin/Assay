"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogoMark,
  BoltIcon,
  BanIcon,
  LedgerIcon,
  WalletIcon,
} from "@/components/icons";

const links = [
  { href: "/app", label: "Agent Run", icon: BoltIcon },
  { href: "/app/refusals", label: "Wall of No", icon: BanIcon },
  { href: "/app/dashboard", label: "Ledger", icon: LedgerIcon },
  { href: "/app/creator", label: "Creator", icon: WalletIcon },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-[15px] font-bold tracking-tight text-white">
            Assay
          </span>
          <span className="hidden rounded-md border border-edge2 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500 sm:block">
            console
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-brand/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-brand2" : ""}`} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <span className="flex items-center gap-1.5 rounded-full border border-buy/25 bg-buy/[0.07] px-2.5 py-1 text-[10px] font-semibold text-buy">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buy" />
            Arc testnet
          </span>
        </div>
      </div>
    </header>
  );
}
