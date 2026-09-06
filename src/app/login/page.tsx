import { signIn } from "@/lib/auth";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-purple-500/25">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-lg font-black tracking-tight text-white">AI STUDIO</h1>
        <p className="mt-1 text-xs text-slate-400">Burjo Level Up — Video AI</p>
        <p className="mt-6 text-sm text-slate-300">
          Masuk dengan akun Google kamu untuk mulai generate prompt &amp; video.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/30 transition hover:brightness-110"
          >
            Masuk dengan Google
          </button>
        </form>
      </div>
    </div>
  );
}
