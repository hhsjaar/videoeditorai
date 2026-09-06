"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  promptCreditsBalance: number;
  freeCreditsRemainingToday: number;
  videoCreditsBalance: number;
  hasVideoPackage: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.users);
        else setError(data.error || "Gagal memuat data.");
      })
      .catch(() => setError("Gagal memuat data."));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!users) return <p className="text-sm text-slate-400">Memuat...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Kredit Prompt</th>
            <th className="px-4 py-3">Kredit Video</th>
            <th className="px-4 py-3">Paket</th>
            <th className="px-4 py-3">Admin</th>
            <th className="px-4 py-3">Daftar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-800/60 last:border-0">
              <td className="px-4 py-3">
                <div className="font-semibold text-white">{u.name || "—"}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </td>
              <td className="px-4 py-3 text-slate-200">
                {(u.promptCreditsBalance + u.freeCreditsRemainingToday).toLocaleString("id-ID")} poin
              </td>
              <td className="px-4 py-3 text-slate-200">{u.videoCreditsBalance.toLocaleString("id-ID")} poin</td>
              <td className="px-4 py-3">
                {u.hasVideoPackage ? (
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-300 border border-purple-500/20">Ya</span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {u.isAdmin ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/20">Admin</span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(u.createdAt).toLocaleDateString("id-ID")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Belum ada user.</p>}
    </div>
  );
}
