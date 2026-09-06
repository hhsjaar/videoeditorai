"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

interface Balances {
  promptAvailable: number;
  videoCreditsBalance: number;
  hasVideoPackage: boolean;
}

export function CreditBadge() {
  const [balances, setBalances] = useState<Balances | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/credits/me");
      if (!res.ok) return;
      const data = await res.json();
      setBalances(data);
    } catch {
      /* best-effort */
    }
  }

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!balances) return null;

  return (
    <Link
      href="/topup"
      className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-500/40 hover:text-amber-300"
      title="Top up kredit"
    >
      <Coins className="h-3.5 w-3.5 text-amber-400" />
      <span>{balances.promptAvailable.toLocaleString("id-ID")} poin</span>
      {balances.hasVideoPackage && (
        <span className="text-slate-500">
          · {balances.videoCreditsBalance.toLocaleString("id-ID")} poin video
        </span>
      )}
    </Link>
  );
}
