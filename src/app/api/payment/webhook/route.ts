import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { grantPackage999k, grantPromptCredits, rupiahToPromptPoin } from "@/lib/credits";

// Midtrans calls this server-to-server (no session cookie) — reachability is
// carved out of the auth gate in src/proxy.ts. Nothing here should be
// trusted without verifying the signature first.
function isValidSignature(body: any): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const expected = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");
  return expected === body.signature_key;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!isValidSignature(body)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const { order_id: orderId, transaction_status: status, fraud_status: fraudStatus } = body;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  // Idempotent: Midtrans may resend the same notification.
  if (order.status === "settlement") {
    return NextResponse.json({ success: true, note: "already settled" });
  }

  const isSuccess = (status === "capture" || status === "settlement") && fraudStatus !== "deny";
  const isFailed = status === "deny" || status === "cancel" || status === "expire";

  if (isSuccess) {
    if (order.kind === "package999k") {
      await grantPackage999k(order.userId, order.id);
    } else {
      await grantPromptCredits(order.userId, rupiahToPromptPoin(order.amountRupiah), order.id);
    }
    await prisma.order.update({ where: { id: orderId }, data: { status: "settlement", settledAt: new Date() } });
  } else if (isFailed) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "failed" } });
  }

  return NextResponse.json({ success: true });
}
