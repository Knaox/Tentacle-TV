import {
  REVOCATION_PATH,
  drainRevocations,
  readUnpairJournal,
  type PendingRevocation,
} from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * La file des révocations en attente, côté téléviseur natif : les anciens
 * jetons mis de côté par `unpairDevice` partent vers leur serveur jusqu'à ce
 * qu'il confirme les avoir oubliés (verdicts et recul : `revocationDrain` de
 * tv-core).
 *
 * Réveillée au déjumelage, au démarrage et au retour au premier plan ; entre
 * deux, elle se replanifie elle-même selon le recul. Une seule vidange à la
 * fois : un déjumelage survenu pendant l'envoi est repris à la fin de celle en
 * cours, qui relit le marqueur.
 */

const REQUEST_TIMEOUT_MS = 10_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let draining = false;

async function send(revocation: PendingRevocation): Promise<number | null> {
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
    const next = await drainRevocations(tvStorage, send, Date.now);
    if (next !== null) scheduleRevocationDrain(next);
  } finally {
    draining = false;
  }
}

/** Planifie la prochaine vidange (remplace celle qui attendait). */
export function scheduleRevocationDrain(delayMs = 0): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void drain();
  }, delayMs);
}

/** Réveil opportuniste (démarrage, premier plan) : seulement s'il reste à faire. */
export function wakeRevocationDrain(): void {
  if (readUnpairJournal(tvStorage).revocations.length > 0) scheduleRevocationDrain(0);
}
