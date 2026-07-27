/**
 * Boucle de transfert d'UN fichier : flux HTTP → `.part` → synchronisation →
 * renommage atomique.
 *
 * Le renommage n'est pas un détail de rangement : tant que le fichier porte
 * `.part`, il n'est pas le fichier final, et rien ne peut le présenter comme
 * lisible. Un transfert interrompu ne laisse donc jamais un média à moitié
 * jouable.
 *
 * Reprise par `Range` pour l'Original — le backend relaie `Accept-Ranges` de
 * Jellyfin. L'Allégé, lui, est un transcodage : il n'est pas rejouable et
 * repart toujours de zéro.
 *
 * Le jeton part en EN-TÊTE, jamais en query, et n'est jamais écrit sur le
 * disque.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/transfer.rs`.
 */

import { existsSync } from "node:fs";
import { open, rename, unlink } from "node:fs/promises";
import type { TransferNet } from "./transferNet";

/** Cadence de persistance de la progression : au plus tôt des deux. */
const PERSIST_EVERY_BYTES = 4 * 1024 * 1024;
const PERSIST_EVERY_MS = 700;

/** Bascules lues à chaque bloc reçu. */
export class TransferFlags {
  cancel = false;
  pause = false;
}

export type TransferEnd =
  | { kind: "complete"; finalSize: number }
  | { kind: "paused"; bytesDone: number }
  | { kind: "canceled" }
  /** Codes STABLES, consommés par l'interface. */
  | { kind: "failed"; code: "network" | "disk-full" | "integrity" | "unavailable" | "io"; bytesDone: number };

export interface TransferJob {
  url: string;
  token: string;
  /** Chemin ABSOLU du fichier final. Le `.part` en dérive. */
  finalPath: string;
  variant: string;
  expectedSize: number | null;
  /** Base du serveur Tentacle — arrêt propre du transcodage Allégé. */
  serverUrl: string;
}

/** Session de transcodage annoncée par le backend (mode Allégé uniquement). */
interface TranscodeSession {
  playSessionId: string;
  deviceId: string;
}

/**
 * Fin de session serveur, best-effort : libère ffmpeg et les fichiers
 * temporaires côté Jellyfin, que le transfert ait abouti, été annulé ou mis en
 * pause. Sans cet appel, un transcodage abandonné continue de tourner.
 */
async function killTranscode(
  reseau: TransferNet,
  job: TransferJob,
  session: TranscodeSession | null,
): Promise<void> {
  if (session === null) return;
  const url =
    `${job.serverUrl}/api/jellyfin/Videos/ActiveEncodings` +
    `?deviceId=${session.deviceId}&playSessionId=${session.playSessionId}`;
  // X-Emby-Token : la route passe par le proxy `/api/jellyfin`.
  await reseau.killTranscode(url, { "X-Emby-Token": job.token });
}

async function retirer(chemin: string): Promise<void> {
  try {
    await unlink(chemin);
  } catch {
    // Déjà absent : c'est le cas courant après un échec.
  }
}

/**
 * Exécute le transfert. `onProgress` est déjà étranglé par cette fonction.
 *
 * Ne lève jamais : toute sortie est un `TransferEnd`, parce que l'appelant doit
 * pouvoir écrire un statut en base dans tous les cas.
 */
export async function run(
  reseau: TransferNet,
  job: TransferJob,
  flags: TransferFlags,
  onProgress: (bytes: number) => void,
): Promise<TransferEnd> {
  const part = `${job.finalPath}.part`;

  // Reprise : Original uniquement. Un transcodage n'est pas rejouable, et
  // reprendre son flux à mi-course donnerait un fichier incohérent.
  let start = 0;
  if (job.variant === "original" && existsSync(part)) {
    const fh = await open(part, "r");
    try {
      start = (await fh.stat()).size;
    } finally {
      await fh.close();
    }
  } else {
    await retirer(part);
  }

  const abort = new AbortController();
  const headers: Record<string, string> = { Authorization: `Bearer ${job.token}` };
  if (start > 0) headers["Range"] = `bytes=${start}-`;

  let flux;
  try {
    flux = await reseau.open(job.url, headers, abort.signal);
  } catch {
    return { kind: "failed", code: "network", bytesDone: start };
  }
  if (flux.status >= 400) {
    const code = flux.status === 404 || flux.status === 403 || flux.status === 401
      ? "unavailable"
      : "network";
    return { kind: "failed", code, bytesDone: start };
  }

  // Session de transcodage capturée AVANT la consommation du corps : il faut
  // pouvoir l'arrêter à toute sortie de boucle.
  const play = flux.header("x-tentacle-play-session");
  const device = flux.header("x-tentacle-device-id");
  const session: TranscodeSession | null =
    play !== null && device !== null ? { playSessionId: play, deviceId: device } : null;

  // 200 alors qu'on demandait une reprise : le serveur a ignoré le `Range`.
  // On repart de zéro proprement plutôt que d'écrire à côté.
  if (flux.status === 200 && start > 0) {
    await retirer(part);
    start = 0;
  }

  let total = start;
  let dernierePersistanceOctets = start;
  let dernierePersistanceAt = Date.now();
  const fh = await open(part, existsSync(part) ? "r+" : "w").catch(() => null);
  if (fh === null) return { kind: "failed", code: "io", bytesDone: start };

  try {
    for await (const bloc of flux.chunks) {
      if (flags.cancel) {
        abort.abort();
        await fh.close();
        await retirer(part);
        await killTranscode(reseau, job, session);
        return { kind: "canceled" };
      }
      if (flags.pause) {
        abort.abort();
        await fh.sync().catch(() => undefined);
        await fh.close();
        await killTranscode(reseau, job, session);
        return { kind: "paused", bytesDone: total };
      }

      try {
        await fh.write(bloc, 0, bloc.byteLength, total);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code === "ENOSPC" ? "disk-full" : "io";
        await fh.sync().catch(() => undefined);
        await fh.close();
        await killTranscode(reseau, job, session);
        return { kind: "failed", code, bytesDone: total };
      }
      total += bloc.byteLength;

      const maintenant = Date.now();
      if (
        total - dernierePersistanceOctets >= PERSIST_EVERY_BYTES ||
        maintenant - dernierePersistanceAt >= PERSIST_EVERY_MS
      ) {
        dernierePersistanceOctets = total;
        dernierePersistanceAt = maintenant;
        onProgress(total);
      }
    }
  } catch {
    await fh.sync().catch(() => undefined);
    await fh.close();
    await killTranscode(reseau, job, session);
    // Flux coupé en cours de route : pause SYSTÈME, donc reprise automatique.
    return { kind: "failed", code: "network", bytesDone: total };
  }

  await killTranscode(reseau, job, session);
  try {
    await fh.sync();
  } catch {
    await fh.close();
    return { kind: "failed", code: "io", bytesDone: total };
  }
  await fh.close();

  // Intégrité : l'Original doit faire EXACTEMENT la taille annoncée. Sinon le
  // fichier source a changé en cours de route, et on repart propre plutôt que
  // de présenter comme lisible un média tronqué.
  if (job.variant === "original" && job.expectedSize !== null && job.expectedSize > 0) {
    if (total !== job.expectedSize) {
      await retirer(part);
      return { kind: "failed", code: "integrity", bytesDone: 0 };
    }
  }
  if (total === 0) {
    await retirer(part);
    return { kind: "failed", code: "integrity", bytesDone: 0 };
  }

  try {
    await rename(part, job.finalPath);
  } catch {
    return { kind: "failed", code: "io", bytesDone: total };
  }
  return { kind: "complete", finalSize: total };
}
