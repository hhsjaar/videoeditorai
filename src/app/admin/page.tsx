import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminUsersTable } from "./AdminUsersTable";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-black tracking-tight text-white">Panel Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Daftar user & saldo kredit.</p>
        <div className="mt-6">
          <AdminUsersTable />
        </div>
      </div>
    </div>
  );
}
