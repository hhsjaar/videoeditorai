import Link from "next/link";
import {
  Sparkles,
  Wand2,
  Clapperboard,
  Mic2,
  Image as ImageIcon,
  Link2,
  Zap,
  Coins,
  ArrowRight,
  Check,
} from "lucide-react";

const STEPS = [
  {
    icon: Wand2,
    title: "Ceritakan Idemu",
    desc: "Tulis satu kalimat santai — mau bikin video apa, buat platform mana, target penontonnya siapa.",
  },
  {
    icon: Clapperboard,
    title: "AI Susun Storyboard",
    desc: "AI riset angle, bikin naskah, dan susun storyboard shot-by-shot lengkap dengan naskah voice over.",
  },
  {
    icon: Sparkles,
    title: "Video Siap Pakai",
    desc: "Klik generate, video vertikal sinematik dengan suara & narasi jadi otomatis — tinggal download.",
  },
];

const FEATURES = [
  { icon: Mic2, title: "Voice Over Otomatis", desc: "Narasi Bahasa Indonesia natural, langsung menyatu di video." },
  { icon: ImageIcon, title: "Foto Jadi Video", desc: "Upload foto produk atau referensi, AI animasikan jadi klip video." },
  { icon: Link2, title: "Remix Video Referensi", desc: "Kasih link video yang kamu suka, AI analisis gayanya dan bikin versi barumu." },
  { icon: Zap, title: "Generate Cepat", desc: "Beberapa klip sekaligus diproses otomatis, tinggal duduk manis." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-md shadow-purple-500/25">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-base font-black tracking-tight text-white sm:text-lg">AI STUDIO</span>
        </div>
        <Link
          href="/chat"
          className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-purple-500/50 hover:text-white sm:text-sm"
        >
          Buka Aplikasi
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16">
        {/* decorative gradient glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-600/25 via-purple-600/20 to-pink-600/20 blur-[110px]" />

        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-300">
              <Sparkles className="h-3 w-3" /> Didukung Gemini AI
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              Dari Ide Jadi Video Pendek,
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"> Cuma Ngobrol Doang.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm text-slate-400 sm:text-base">
              Ceritain ide videomu ke AI Studio — riset topik, naskah, storyboard, sampai video jadi dengan suara, semuanya otomatis. Cocok buat konten TikTok, Reels, dan YouTube Shorts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110"
              >
                Mulai Sekarang — Gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Coins className="h-4 w-4 text-amber-400" /> 60 poin gratis tiap hari, tanpa kartu kredit
              </div>
            </div>
          </div>

          {/* Hero illustration — a stylized vertical-video phone mockup */}
          <div className="relative mx-auto w-full max-w-xs sm:max-w-sm">
            <svg viewBox="0 0 320 460" className="w-full drop-shadow-2xl">
              <defs>
                <linearGradient id="phoneScreen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4338ca" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#db2777" />
                </linearGradient>
                <linearGradient id="phoneBody" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>
              <rect x="20" y="10" width="280" height="440" rx="36" fill="url(#phoneBody)" stroke="#334155" strokeWidth="2" />
              <rect x="34" y="26" width="252" height="408" rx="24" fill="url(#phoneScreen)" opacity="0.9" />
              {/* play button */}
              <circle cx="160" cy="230" r="34" fill="white" fillOpacity="0.15" />
              <circle cx="160" cy="230" r="34" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
              <path d="M150 213 L178 230 L150 247 Z" fill="white" />
              {/* waveform bars near bottom, suggesting voice over */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <rect
                  key={i}
                  x={70 + i * 22}
                  y={360 - [18, 30, 12, 26, 34, 16, 24, 14][i]}
                  width="10"
                  height={[18, 30, 12, 26, 34, 16, 24, 14][i]}
                  rx="4"
                  fill="white"
                  fillOpacity="0.65"
                />
              ))}
              {/* sparkle accents */}
              <g fill="#fde68a">
                <path d="M258 70 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z" />
                <path d="M64 100 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="border-t border-slate-900 bg-slate-950/60 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Cuma 3 Langkah</h2>
            <p className="mt-3 text-sm text-slate-400 sm:text-base">Tidak perlu skill editing atau kamera — cukup ide, sisanya AI yang kerjakan.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-purple-300 border border-purple-500/20">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="absolute right-5 top-5 text-3xl font-black text-slate-800">0{i + 1}</span>
                <h3 className="text-sm font-bold text-white sm:text-base">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Semua yang Kamu Butuh</h2>
            <p className="mt-3 text-sm text-slate-400 sm:text-base">Satu chat, banyak cara bikin konten.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-purple-500/30 hover:bg-slate-900/70"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ──────────────────────────────────────────────── */}
      <section className="border-t border-slate-900 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Mulai Gratis, Upgrade Kalau Butuh</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-sm font-bold text-slate-300">Gratis Tiap Hari</h3>
              <p className="mt-2 text-3xl font-black text-white">60 poin</p>
              <p className="mt-1 text-xs text-slate-500">Cukup buat riset ide & bikin naskah prompt.</p>
              <ul className="mt-5 space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Riset topik & storyboard</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Mode prompt-only per 10 detik</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-slate-900/60 p-6">
              <h3 className="text-sm font-bold text-purple-300">Paket Generate Video</h3>
              <p className="mt-2 text-3xl font-black text-white">Rp999rb</p>
              <p className="mt-1 text-xs text-slate-500">Sekali beli, buka fitur generate video sungguhan.</p>
              <ul className="mt-5 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> ±42 klip video otomatis</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /> Plus 100 menit kredit prompt</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-purple-950/40 p-8 sm:p-12">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Yuk, Bikin Video Pertamamu</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">Tidak perlu login dulu — langsung coba ceritakan ide videomu sekarang.</p>
            <Link
              href="/chat"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110"
            >
              Coba Sekarang <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} AI Studio — Burjo Level Up
      </footer>
    </div>
  );
}
