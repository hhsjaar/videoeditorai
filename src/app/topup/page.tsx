"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft, Coins, Sparkles } from "lucide-react";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        opts: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

const MIN_TOPUP = 150_000;
const RUPIAH_PER_POIN = 150_000 / 6000;

interface Balances {
  promptAvailable: number;
  videoCreditsBalance: number;
  hasVideoPackage: boolean;
}

function formatRp(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export default function TopupPage() {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("150000");
  const [loading, setLoading] = useState<"topup" | "package" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapReady, setSnapReady] = useState(false);

  async function refreshBalances() {
    const res = await fetch("/api/credits/me");
    if (res.ok) setBalances(await res.json());
  }

  useEffect(() => {
    refreshBalances();
  }, []);

  async function startPayment(kind: "topup" | "package999k", amountRupiah?: number) {
    setError(null);
    setLoading(kind === "package999k" ? "package" : "topup");
    try {
      const res = await fetch("/api/payment/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, amountRupiah }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi.");

      if (!window.snap) throw new Error("Payment popup belum siap, coba lagi sebentar.");
      window.snap.pay(data.token, {
        onSuccess: () => refreshBalances(),
        onPending: () => refreshBalances(),
        onError: () => setError("Pembayaran gagal, silakan coba lagi."),
      });
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(null);
    }
  }

  const amountNum = Number(customAmount) || 0;
  const poinFromAmount = Math.floor(amountNum / RUPIAH_PER_POIN);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <Script
        src="https://app.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        onLoad={() => setSnapReady(true)}
      />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <h1 className="text-2xl font-black tracking-tight text-white">Top Up Kredit</h1>
        <p className="mt-1 text-sm text-slate-400">
          Kredit dipakai untuk fitur prompting & generate video di Video AI.
        </p>

        {balances && (
          <div className="mt-6 flex flex-wrap gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Kredit prompt</p>
              <p className="text-lg font-bold text-white">{balances.promptAvailable.toLocaleString("id-ID")} poin</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Kredit video</p>
              <p className="text-lg font-bold text-white">
                {balances.hasVideoPackage ? `${balances.videoCreditsBalance.toLocaleString("id-ID")} poin` : "Belum punya paket"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Custom top-up */}
        <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Top Up Kredit Prompt</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Minimum {formatRp(MIN_TOPUP)} = 100 menit / 6.000 poin. Bisa custom jumlahnya.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-slate-400">Rp</span>
            <input
              type="number"
              min={MIN_TOPUP}
              step={10000}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-500">≈ {poinFromAmount.toLocaleString("id-ID")} poin</span>
          </div>
          <button
            onClick={() => startPayment("topup", amountNum)}
            disabled={loading !== null || !snapReady || amountNum < MIN_TOPUP}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === "topup" ? "Memproses..." : `Top Up ${formatRp(amountNum || 0)}`}
          </button>
        </div>

        {/* Rp999k package */}
        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-slate-900/60 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Paket Generate Video — {formatRp(999_000)}</h2>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>• Buka akses fitur generate video (mode &quot;Durasi default&quot;)</li>
            <li>• Dapat 100 menit / 6.000 poin kredit prompt</li>
            <li>• Dapat ±42 klip / 252 detik kredit video</li>
          </ul>
          <button
            onClick={() => startPayment("package999k")}
            disabled={loading !== null || !snapReady}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === "package" ? "Memproses..." : "Beli Paket Rp999.000"}
          </button>
        </div>
      </div>
    </div>
  );
}
