import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      promptCreditsBalance: true,
      freeCreditsRemainingToday: true,
      videoCreditsBalance: true,
      hasVideoPackage: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, users });
}
