import { getPrisma, hasPrisma } from "./db";
import { deleteJellyfinDevice } from "./jellyfinQuickConnect";

/**
 * Le journal des appareils Jellyfin frappés pour des TV (`paired_device_cleanups`)
 * — ce qui garantit qu'aucun ne survit chez Jellyfin à son jumelage, même si
 * Tentacle plante au mauvais moment.
 *
 * Une entrée est écrite AVANT le geste risqué, soldée APRÈS :
 * - `minting` : avant de frapper un jeton (`deviceJellyfinToken.ts`). Soldée
 *   quand la ligne du jumelage porte l'appareil ; sinon — plantage entre la
 *   frappe et l'enregistrement, jumelage révoqué pendant la frappe —
 *   l'appareil est supprimé de Jellyfin. Jamais balayée avant `MINTING_GRACE_MS` :
 *   une frappe en cours n'est pas une frappe orpheline.
 * - `revoked` : dans la transaction qui supprime le jumelage. L'appareil est
 *   supprimé de Jellyfin aussitôt, et jusqu'à confirmation sinon.
 *
 * Règle unique du balayage : une entrée dont le jumelage porte ENCORE cet
 * appareil est soldée sans rien toucher ; toute autre fait disparaître
 * l'appareil de Jellyfin. Un appareil inconnu de Jellyfin compte pour fait.
 *
 * Le balayeur ne touche que les entrées de ce journal — jamais un appareil
 * Jellyfin qu'il n'a pas frappé lui-même, ni un jumelage vivant.
 */

export type CleanupReason = "minting" | "revoked";

export const MINTING_GRACE_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const SWEEP_BATCH = 50;

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
}

/** Inscrit un appareil au journal. Une révocation l'emporte sur une frappe :
 *  `minting` ne rétrograde jamais une entrée `revoked`. */
export async function noteJellyfinDevice(jellyfinDeviceId: string, tokenHash: string, reason: CleanupReason): Promise<void> {
  await getPrisma().pairedDeviceCleanup.upsert({
    where: { jellyfinDeviceId },
    create: { jellyfinDeviceId, tokenHash, reason },
    update: reason === "revoked" ? { reason, nextAttemptAt: new Date() } : {},
  });
}

/** Rien à faire disparaître : l'entrée est soldée. */
export async function settleJellyfinDevice(jellyfinDeviceId: string): Promise<void> {
  await getPrisma().pairedDeviceCleanup.deleteMany({ where: { jellyfinDeviceId } });
}

/**
 * Traite une entrée tout de suite. `true` : soldée (appareil légitime, ou
 * disparu de Jellyfin) ; `false` : Jellyfin n'a pas confirmé, nouvelle
 * tentative planifiée.
 */
export async function cleanupJellyfinDevice(jellyfinDeviceId: string): Promise<boolean> {
  if (!hasPrisma()) return false;
  const prisma = getPrisma();
  const entry = await prisma.pairedDeviceCleanup.findUnique({ where: { jellyfinDeviceId } });
  if (!entry) return true;
  const pairing = await prisma.pairedDevice.findUnique({
    where: { tokenHash: entry.tokenHash },
    select: { jellyfinDeviceId: true },
  });
  if (pairing?.jellyfinDeviceId !== jellyfinDeviceId) {
    const outcome = await deleteJellyfinDevice(jellyfinDeviceId);
    if (outcome === "retry") {
      await prisma.pairedDeviceCleanup.update({
        where: { jellyfinDeviceId },
        data: { attempts: entry.attempts + 1, nextAttemptAt: new Date(Date.now() + retryDelay(entry.attempts)) },
      });
      return false;
    }
  }
  await settleJellyfinDevice(jellyfinDeviceId);
  return true;
}

/** Le balayage : au démarrage (reprise après plantage) puis à chaque passage de
 *  `pairingCleanup`. Les frappes récentes sont laissées à leur auteur. */
export async function sweepJellyfinDevices(now: number = Date.now()): Promise<void> {
  if (!hasPrisma()) return;
  const due = await getPrisma().pairedDeviceCleanup.findMany({
    where: { nextAttemptAt: { lte: new Date(now) } },
    orderBy: { nextAttemptAt: "asc" },
    take: SWEEP_BATCH,
  });
  for (const entry of due) {
    if (entry.reason === "minting" && now - entry.createdAt.getTime() < MINTING_GRACE_MS) continue;
    await cleanupJellyfinDevice(entry.jellyfinDeviceId).catch(() => false);
  }
}
