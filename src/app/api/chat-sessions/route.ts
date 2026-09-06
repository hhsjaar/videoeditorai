import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// List this user's saved chat threads for the history sidebar (newest first,
// title + timestamps only — the full `data` blob is fetched per-thread on demand).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ success: true, sessions });
}

// Creates a new saved thread. The client calls this once per fresh
// conversation (after login), then PUTs to /api/chat-sessions/[id] to
// autosave as the conversation grows.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });

  const { title, data } = await req.json();
  const created = await prisma.chatSession.create({
    data: {
      userId: session.user.id,
      title: (title || "Obrolan baru").slice(0, 80),
      data: JSON.stringify(data ?? {}),
    },
  });
  return NextResponse.json({ success: true, id: created.id });
}
