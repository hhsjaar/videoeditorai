import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBalances } from "@/lib/credits";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }
  const balances = await getBalances(session.user.id);
  return NextResponse.json({ success: true, ...balances });
}
