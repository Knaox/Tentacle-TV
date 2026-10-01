import {
  REVOCATION_PATH,
  drainRevocations,
  readUnpairJournal,
  type PendingRevocation,
} from "@tentacle-tv/tv-core";
import { pageStorage } from "./pageStorage";

/**
 * La file des révocations en attente, côté LG — la même que celle de la TV
 * native (`apps/tv/src/auth/revocationQueue.ts`), sur le stockage de la page.
 * Réveillée au déjumelage, au démarrage et au retour du réseau ; entre deux,
 * elle se replanifie selon le recul de tv-core.
 */

const REQUEST_TIMEOUT_MS = 10_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let draining = false;

async function send(revocation: PendingRevocation): Promise<number | null> {
  // AbortController existe sur la dalle (polyfill d'amorçage pour Chrome 53).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${revocation.serverUrl.replace(/\/+$/, "")}${REVOCATION_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${revocation.token}` },
      signal: controller.signal,
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    // La suivante est planifiée ici, mais ne part qu'après ce `finally`.
    const next = await drainRevocations(pageStorage, send, Date.now);
    if (next !== null) scheduleRevocationDrainTv(next);
  } finally {
    draining = false;
  }
}

export function scheduleRevocationDrainTv(delayMs = 0): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void drain();
  }, delayMs);
}

/** Réveil opportuniste : seulement s'il reste à faire. */
export function wakeRevocationDrainTv(): void {
  if (readUnpairJournal(pageStorage).revocations.length > 0) scheduleRevocationDrainTv(0);
}
