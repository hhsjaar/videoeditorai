import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chargePromptCredits, getBalances, InsufficientCreditsError } from "@/lib/credits";

// Server-enforced gate for the two Video AI modes — called by the frontend
// right when the user picks a mode (see VideoAIChat.tsx's duration-choice
// handlers), BEFORE the ideation pipeline (concepts/QA/storyboard) runs.
// Never trust a client-computed cost: promptOnly's cost is recomputed here
// from requestedTotalSeconds, and mode "video" is hard-gated on hasVideoPackage.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }
  const userId = session.user.id;

  const { mode, requestedTotalSeconds } = await req.json();

  try {
    if (mode === "prompt-only") {
      const seconds = Number(requestedTotalSeconds);
      if (!Number.isInteger(seconds) || seconds < 10 || seconds % 10 !== 0) {
        return NextResponse.json({ error: "Durasi tidak valid." }, { status: 400 });
      }
      await chargePromptCredits(userId, seconds, "mode_a_charge");
    } else if (mode === "video") {
      const { hasVideoPackage } = await getBalances(userId);
      if (!hasVideoPackage) {
        return NextResponse.json(
          { error: "Fitur generate video butuh paket Rp999.000.", code: "NEEDS_PACKAGE" },
          { status: 403 }
        );
      }
      await chargePromptCredits(userId, 50, "mode_b_flat_charge");
    } else {
      return NextResponse.json({ error: "Mode tidak dikenal." }, { status: 400 });
    }

    const balances = await getBalances(userId);
    return NextResponse.json({ success: true, ...balances });
  } catch (err: any) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: err.message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }
    console.error("Error charging credits:", err);
    return NextResponse.json({ error: "Gagal memproses kredit." }, { status: 500 });
  }
}
