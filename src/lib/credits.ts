import { prisma } from "@/lib/prisma";

export class InsufficientCreditsError extends Error {
  constructor(public pool: "prompt" | "video", public needed: number, public available: number) {
    super(`Kredit ${pool} tidak cukup (butuh ${needed}, tersisa ${available}).`);
  }
}

// Free daily grant resets at midnight Asia/Jakarta (WIB, UTC+7) — no DST, so
// a fixed offset is enough (no need for a timezone library).
function todayInJakarta(): string {
  const jakartaMs = Date.now() + 7 * 60 * 60 * 1000;
  return new Date(jakartaMs).toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const FREE_DAILY_POIN = 60;

// Lazily tops up today's free grant if it hasn't been given yet — called at
// the top of every credit-consuming request so a user's first action each
// day always sees a fresh 60 poin, without needing a cron job.
async function ensureDailyGrant(userId: string) {
  const today = todayInJakarta();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.lastFreeGrantDate === today) return user;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { freeCreditsRemainingToday: FREE_DAILY_POIN, lastFreeGrantDate: today },
  });
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "daily_free_grant",
      pool: "prompt",
      amount: FREE_DAILY_POIN,
      balanceAfter: updated.freeCreditsRemainingToday + updated.promptCreditsBalance,
    },
  });
  return updated;
}

export async function getBalances(userId: string) {
  const user = await ensureDailyGrant(userId);
  return {
    promptAvailable: user.freeCreditsRemainingToday + user.promptCreditsBalance,
    videoCreditsBalance: user.videoCreditsBalance,
    hasVideoPackage: user.hasVideoPackage,
  };
}

// Consumes free credits first (they don't roll over, so use-it-or-lose-it),
// then the purchased/package balance.
export async function chargePromptCredits(userId: string, amount: number, type: string, relatedJobId?: string) {
  return prisma.$transaction(async (tx) => {
    await ensureDailyGrant(userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const available = user.freeCreditsRemainingToday + user.promptCreditsBalance;
    if (available < amount) throw new InsufficientCreditsError("prompt", amount, available);

    const fromFree = Math.min(user.freeCreditsRemainingToday, amount);
    const fromPurchased = amount - fromFree;

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        freeCreditsRemainingToday: user.freeCreditsRemainingToday - fromFree,
        promptCreditsBalance: user.promptCreditsBalance - fromPurchased,
      },
    });
    const balanceAfter = updated.freeCreditsRemainingToday + updated.promptCreditsBalance;
    await tx.creditTransaction.create({
      data: { userId, type, pool: "prompt", amount: -amount, balanceAfter, relatedJobId },
    });
    return balanceAfter;
  });
}

export async function chargeVideoCredits(userId: string, amount: number, jobId: string, type: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.videoCreditsBalance < amount) {
      throw new InsufficientCreditsError("video", amount, user.videoCreditsBalance);
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { videoCreditsBalance: user.videoCreditsBalance - amount },
    });
    await tx.creditTransaction.create({
      data: { userId, type, pool: "video", amount: -amount, balanceAfter: updated.videoCreditsBalance, relatedJobId: jobId },
    });
    await tx.videoJobOwner.create({ data: { jobId, userId, poinCharged: amount } });
    return updated.videoCreditsBalance;
  });
}

// Refunds a failed job's charge exactly once — safe to call even if the job
// was never charged (e.g. race with a server restart) or already refunded.
export async function refundVideoCredits(jobId: string) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.videoJobOwner.findUnique({ where: { jobId } });
    if (!owner || owner.refunded) return;

    const updated = await tx.user.update({
      where: { id: owner.userId },
      data: { videoCreditsBalance: { increment: owner.poinCharged } },
    });
    await tx.videoJobOwner.update({ where: { jobId }, data: { refunded: true } });
    await tx.creditTransaction.create({
      data: {
        userId: owner.userId,
        type: "video_generation_refund",
        pool: "video",
        amount: owner.poinCharged,
        balanceAfter: updated.videoCreditsBalance,
        relatedJobId: jobId,
      },
    });
  });
}

const PROMPT_POIN_PER_RUPIAH = 6000 / 150000; // Rp150,000 = 100 menit = 6,000 poin
export const PACKAGE_999K_PROMPT_POIN = 6000;
export const PACKAGE_999K_VIDEO_POIN = 252; // 42 clips worth, see plan for the Rp math

export function rupiahToPromptPoin(amountRupiah: number): number {
  return Math.floor(amountRupiah * PROMPT_POIN_PER_RUPIAH);
}

export async function grantPromptCredits(userId: string, poin: number, relatedOrderId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { promptCreditsBalance: { increment: poin } },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "topup_prompt",
        pool: "prompt",
        amount: poin,
        balanceAfter: updated.freeCreditsRemainingToday + updated.promptCreditsBalance,
        relatedOrderId,
      },
    });
  });
}

export async function grantPackage999k(userId: string, relatedOrderId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        promptCreditsBalance: { increment: PACKAGE_999K_PROMPT_POIN },
        videoCreditsBalance: { increment: PACKAGE_999K_VIDEO_POIN },
        hasVideoPackage: true,
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "package999k",
        pool: "prompt",
        amount: PACKAGE_999K_PROMPT_POIN,
        balanceAfter: updated.freeCreditsRemainingToday + updated.promptCreditsBalance,
        relatedOrderId,
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "package999k",
        pool: "video",
        amount: PACKAGE_999K_VIDEO_POIN,
        balanceAfter: updated.videoCreditsBalance,
        relatedOrderId,
      },
    });
  });
}
