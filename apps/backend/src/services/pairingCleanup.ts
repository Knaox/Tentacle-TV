import { getPrisma } from "./db";

const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
let timer: ReturnType<typeof setInterval> | null = null;

async function cleanup(): Promise<void> {
  try {
    const prisma = getPrisma();
    const result = await prisma.pairingCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`[PairingCleanup] Deleted ${result.count} expired code(s)`);
    }
  } catch (err) {
    console.error("[PairingCleanup] Error:", err);
  }
}

export function startPairingCleanup(): void {
  if (timer) return;
  console.log("[PairingCleanup] Started (interval: 10min)");
  timer = setInterval(cleanup, CLEANUP_INTERVAL);
  cleanup(); // Run immediately on startup
}

export function stopPairingCleanup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
