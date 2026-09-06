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
    // midtrans-client's internal axios instance has NO request timeout
    // configured — if the network between this server and Midtrans hangs
    // (routing hiccup, firewall black hole, etc.), createTransaction() would
    // otherwise wait forever and the client's "Memproses..." button would
    // never resolve either way. Race it against our own timeout so this
    // route always responds within a bounded time.
    const timeoutMs = 20_000;
    const transaction: any = await Promise.race([
      snap.createTransaction({
        transaction_details: { order_id: orderId, gross_amount: amount },
        customer_details: {
          email: session.user.email || undefined,
          first_name: session.user.name || undefined,
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Midtrans tidak merespons dalam ${timeoutMs / 1000}s (kemungkinan masalah jaringan server ke Midtrans).`)), timeoutMs)
      ),
    ]);

    if (!transaction?.token) {
      console.error("Midtrans createTransaction returned no token:", JSON.stringify(transaction));
      throw new Error("Midtrans tidak mengembalikan token pembayaran.");
    }

    return NextResponse.json({ success: true, token: transaction.token, orderId });
  } catch (err: any) {
    // Surface Midtrans's own error body when present (invalid merchant
    // config, domain not whitelisted, bad server key, etc.) — this is what
    // shows up in `pm2 logs` and is the fastest way to pin down a stuck
    // production payment without SSH-ing in to add more logging.
    console.error("Error creating Midtrans transaction:", err?.ApiResponse || err?.message || err);
    await prisma.order.update({ where: { id: orderId }, data: { status: "failed" } }).catch(() => {});
    return NextResponse.json({ error: err?.message || "Gagal membuat transaksi pembayaran." }, { status: 500 });
  }
}
