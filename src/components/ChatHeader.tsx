"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Sparkles, LogOut, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { CreditBadge } from "./CreditBadge";

export function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/80 px-3 backdrop-blur-xl sm:h-16 sm:px-6">
      <div className="flex items-center gap-2">
        {session && (
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200 sm:hidden"
            aria-label="Toggle riwayat"
          >
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
        )}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-md shadow-purple-500/25 sm:h-9 sm:w-9">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="hidden text-sm font-black tracking-tight text-white sm:inline sm:text-base">AI STUDIO</span>
        </Link>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {status === "loading" ? null : session ? (
          <>
            <CreditBadge />
            <button
              onClick={() => signOut({ redirectTo: "/" })}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-red-500/40 hover:text-red-300"
              title="Keluar"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition hover:brightness-110 sm:px-4 sm:py-2 sm:text-sm"
          >
            Masuk
          </button>
        )}
      </div>
    </header>
  );
}
