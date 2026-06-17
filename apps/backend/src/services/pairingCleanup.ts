import { getPrisma } from "./db";
import { hashToken } from "./jwt";
import { deleteProvisioningCode } from "./relayProvision";

const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Auto-désactivation du code de provisionnement expiré : passé sa date, on
 * remet enabled=false, on révoque l'appareil et l'entrée relay (« on reste
 * safe » — l'option se désactive seule). Le KV relay expire aussi de lui-même.
 */
async function disableExpiredProvisioning(): Promise<void> {
  const prisma = getPrisma();
  const expired = await prisma.provisioningCode.findMany({
    where: { enabled: true, expiresAt: { lt: new Date() } },
  });
  for (const row of expired) {
    if (row.token) {
      await prisma.pairedDevice
        .deleteMany({ where: { tokenHash: hashToken(row.token) } })
        .catch(() => {});
    }
    await deleteProvisioningCode(row.code);
    await prisma.provisioningCode.update({
      where: { id: row.id },
      data: { enabled: false, token: null },
    });
    console.log(`[PairingCleanup] Provisioning code disabled (expired)`);
  }
}

async function cleanup(): Promise<void> {
  try {
    const prisma = getPrisma();
    const result = await prisma.pairingCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`[PairingCleanup] Deleted ${result.count} expired code(s)`);
    }
    await disableExpiredProvisioning();
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
