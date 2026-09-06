"use client";

import React from "react";
import { signOut } from "next-auth/react";
import {
  Sparkles,
  Layers,
  Wand2,
  LogOut,
} from "lucide-react";
import { CreditBadge } from "./CreditBadge";

export type ActiveTabType = "klip-ai" | "video-ai" | "animasi-ai";

interface NavbarProps {
  activeTab: ActiveTabType;
  onTabChange: (tab: ActiveTabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 opacity-30 blur-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white sm:text-lg">
                AI STUDIO
              </span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                BURJO LEVEL UP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              All-in-One AI Video & Clip Engine
            </p>
          </div>
        </div>

        {/* 2 Main Feature Tabs — Studio Workspace (Klip AI) is disabled in the commercial build */}
        <nav className="flex items-center gap-1 rounded-2xl bg-slate-900/90 p-1.5 border border-slate-800/80 shadow-inner">
          {/* Tab 2: Video AI */}
          <button
            id="tab-video-ai"
            onClick={() => onTabChange("video-ai")}
            className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
              activeTab === "video-ai"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30 font-bold"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <Wand2 className="h-4 w-4 text-purple-300" />
            <span>Video AI</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
          </button>

          {/* Tab 3: Animasi AI (Coming Soon) */}
          <button
            id="tab-animasi-ai"
            onClick={() => onTabChange("animasi-ai")}
            className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
              activeTab === "animasi-ai"
                ? "bg-slate-800 text-slate-200 border border-slate-700"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-300"
            }`}
          >
            <Layers className="h-4 w-4 text-amber-400/80 group-hover:text-amber-400" />
            <span>Animasi AI</span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20">
              Segera Hadir
            </span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <CreditBadge />
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-red-500/40 hover:text-red-300"
            title="Keluar"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
