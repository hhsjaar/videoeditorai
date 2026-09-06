import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { snap, MIN_TOPUP_RUPIAH, PACKAGE_999K_RUPIAH } from "@/lib/midtrans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }

  const { kind, amountRupiah } = await req.json();

  let amount: number;
  if (kind === "package999k") {
    amount = PACKAGE_999K_RUPIAH;
  } else if (kind === "topup") {
    amount = Number(amountRupiah);
    if (!Number.isInteger(amount) || amount < MIN_TOPUP_RUPIAH) {
      return NextResponse.json(
        { error: `Minimum top up Rp${MIN_TOPUP_RUPIAH.toLocaleString("id-ID")}.` },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "Jenis pembelian tidak dikenal." }, { status: 400 });
  }

  const orderId = `${kind === "package999k" ? "PKG" : "TOP"}-${Date.now()}-${randomUUID().slice(0, 8)}`;

  await prisma.order.create({
    data: { id: orderId, userId: session.user.id, kind, amountRupiah: amount, status: "pending" },
  });

  try {
    const transaction = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details: {
        email: session.user.email || undefined,
        first_name: session.user.name || undefined,
      },
    });
    return NextResponse.json({ success: true, token: transaction.token, orderId });
  } catch (err: any) {
    console.error("Error creating Midtrans transaction:", err);
    return NextResponse.json({ error: "Gagal membuat transaksi pembayaran." }, { status: 500 });
  }
}
