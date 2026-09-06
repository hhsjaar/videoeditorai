"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, Trash2, X } from "lucide-react";

interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function ChatHistorySidebar({
  open,
  onClose,
  activeSessionId,
  refreshKey,
  onSelectSession,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  activeSessionId: string | null;
  refreshKey: number;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chat-sessions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSessions(data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    if (id === activeSessionId) onNewChat();
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/60 sm:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-800/80 bg-slate-950 transition-transform duration-200 sm:static sm:z-0 sm:translate-x-0 sm:bg-slate-950/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-3 sm:h-16">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Riwayat Obrolan</span>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:text-slate-200 sm:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-300 transition hover:border-purple-500 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Obrolan Baru
          </button>
        </div>

        <div className="space-y-0.5 overflow-y-auto px-2 pb-4" style={{ maxHeight: "calc(100vh - 8rem)" }}>
          {loading && <p className="px-2 py-3 text-xs text-slate-500">Memuat...</p>}
          {!loading && sessions.length === 0 && (
            <p className="px-2 py-3 text-xs text-slate-500">Belum ada obrolan tersimpan.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs transition ${
                s.id === activeSessionId
                  ? "bg-purple-500/10 text-white border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{s.title}</span>
              <Trash2
                className="h-3.5 w-3.5 shrink-0 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                onClick={(e) => handleDelete(e, s.id)}
              />
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
