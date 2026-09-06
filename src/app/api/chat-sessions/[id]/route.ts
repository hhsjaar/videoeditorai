import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function loadOwned(id: string, userId: string) {
  const found = await prisma.chatSession.findUnique({ where: { id } });
  if (!found || found.userId !== userId) return null;
  return found;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });

  const { id } = await params;
  const found = await loadOwned(id, session.user.id);
  if (!found) return NextResponse.json({ error: "Obrolan tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ success: true, id: found.id, title: found.title, data: JSON.parse(found.data) });
}

// Autosave — the client calls this periodically as the conversation grows.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });

  const { id } = await params;
  const found = await loadOwned(id, session.user.id);
  if (!found) return NextResponse.json({ error: "Obrolan tidak ditemukan." }, { status: 404 });

  const { title, data } = await req.json();
  await prisma.chatSession.update({
    where: { id },
    data: { ...(title ? { title: title.slice(0, 80) } : {}), ...(data !== undefined ? { data: JSON.stringify(data) } : {}) },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });

  const { id } = await params;
  const found = await loadOwned(id, session.user.id);
  if (!found) return NextResponse.json({ error: "Obrolan tidak ditemukan." }, { status: 404 });

  await prisma.chatSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
