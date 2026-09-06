import midtransClient from "midtrans-client";

export const snap = new midtransClient.Snap({
  isProduction: true,
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

export const MIN_TOPUP_RUPIAH = 150_000;
export const PACKAGE_999K_RUPIAH = 999_000;
