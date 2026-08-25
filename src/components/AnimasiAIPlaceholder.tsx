"use client";

import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  Zap,
  Film,
  CheckCircle2,
  Clock,
  Play,
  ArrowRight,
  Palette,
  Bot,
  Bell,
  Cpu,
} from "lucide-react";

export const AnimasiAIPlaceholder: React.FC<{ onExploreVideoAI: () => void }> = ({
  onExploreVideoAI,
}) => {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-tr from-amber-600/20 via-purple-600/20 to-pink-600/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl space-y-10">
        {/* Header Badge */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-sm backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
            <span>FITUR DALAM TAHAP PENGEMBANGAN</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-amber-200 via-orange-300 to-pink-400 bg-clip-text text-transparent">
            Animasi AI Studio
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400">
            Hasilkan animasi kartun 2D, anime eksklusif, hingga 3D karakter claymation secara instan dengan engine generative neural Gemini & motion capture.
          </p>
        </div>

        {/* Feature Teasers Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-amber-500/40 hover:bg-slate-900/80">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Palette className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Anime & Cartoon 2D
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Konversi naskah menjadi karakter anime dan kartun dengan ekspresi wajah & lipsync otomatis.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
              <Clock className="h-3.5 w-3.5" /> Segera Hadir di Q4
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-purple-500/40 hover:bg-slate-900/80">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              3D Character Rigging
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Karakter 3D fotorealistik atau Pixar-style dengan gerakan natural mengikuti voice over AI.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
              <Clock className="h-3.5 w-3.5" /> Dalam Tahap Training
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-pink-500/40 hover:bg-slate-900/80">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Motion Tracking AI
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Animasi objek & text tracking otomatis menempel pada video tanpa perlu keyframing manual.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-pink-400">
              <Clock className="h-3.5 w-3.5" /> Research & Preview
            </div>
          </div>
        </div>

        {/* Action / Callout banner */}
        <div className="rounded-3xl border border-gradient-to-r border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-8 shadow-2xl text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">
              Sementara Ini, Gunakan Fitur Video AI (Gemini Engine)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Anda sudah bisa membuat video sinematik lengkap dengan naskah, konsep otomatis dari Gemini, dan Voice Over AI sekarang juga di tab Video AI!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onExploreVideoAI}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/30 hover:opacity-95 transition-all"
            >
              <span>Buka Fitur Video AI</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
