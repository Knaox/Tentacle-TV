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
import { mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
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
  net: TransferNet,
  job: TransferJob,
  session: TranscodeSession | null,
): Promise<void> {
  if (session === null) return;
  const url =
    `${job.serverUrl}/api/jellyfin/Videos/ActiveEncodings` +
    `?deviceId=${session.deviceId}&playSessionId=${session.playSessionId}`;
  // X-Emby-Token : la route passe par le proxy `/api/jellyfin`.
  await net.killTranscode(url, { "X-Emby-Token": job.token });
}

async function remove(path: string): Promise<void> {
  try {
    await unlink(path);
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
  net: TransferNet,
  job: TransferJob,
  flags: TransferFlags,
  onProgress: (bytes: number) => void,
): Promise<TransferEnd> {
  const part = `${job.finalPath}.part`;

  // Le dossier de l'item n'existe pas au premier transfert, et RIEN d'autre ne
  // le crée : `ensureLayout` ne pose que `media/` et `meta/` à la racine, et
  // `meta`, `subs` et `trickplay` créent chacun LEUR dossier, jamais celui du
  // média. Sans cette ligne, `open(part, "w")` échoue en ENOENT et TOUT
  // téléchargement se solde par un `io` à zéro octet.
  //
  // Même geste que `transfer.rs:85`, que le portage avait perdu — et que les
  // tests ne pouvaient pas voir : leur fixture créait le dossier elle-même.
  try {
    await mkdir(path.dirname(job.finalPath), { recursive: true });
  } catch {
    return { kind: "failed", code: "io", bytesDone: 0 };
  }

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
    await remove(part);
  }

  const abort = new AbortController();
  const headers: Record<string, string> = { Authorization: `Bearer ${job.token}` };
  if (start > 0) headers["Range"] = `bytes=${start}-`;

  let stream;
  try {
    stream = await net.open(job.url, headers, abort.signal);
  } catch {
    return { kind: "failed", code: "network", bytesDone: start };
  }
  if (stream.status >= 400) {
    const code = stream.status === 404 || stream.status === 403 || stream.status === 401
      ? "unavailable"
      : "network";
    return { kind: "failed", code, bytesDone: start };
  }

  // Session de transcodage capturée AVANT la consommation du corps : il faut
  // pouvoir l'arrêter à toute sortie de boucle.
  const play = stream.header("x-tentacle-play-session");
  const device = stream.header("x-tentacle-device-id");
  const session: TranscodeSession | null =
    play !== null && device !== null ? { playSessionId: play, deviceId: device } : null;

  // 200 alors qu'on demandait une reprise : le serveur a ignoré le `Range`.
  // On repart de zéro proprement plutôt que d'écrire à côté.
  if (stream.status === 200 && start > 0) {
    await remove(part);
    start = 0;
  }

  let total = start;
  let lastPersistBytes = start;
  let lastPersistAt = Date.now();
  const fh = await open(part, existsSync(part) ? "r+" : "w").catch(() => null);
  if (fh === null) return { kind: "failed", code: "io", bytesDone: start };

  try {
    for await (const chunk of stream.chunks) {
      if (flags.cancel) {
        abort.abort();
        await fh.close();
        await remove(part);
        await killTranscode(net, job, session);
        return { kind: "canceled" };
      }
      if (flags.pause) {
        abort.abort();
        await fh.sync().catch(() => undefined);
        await fh.close();
        await killTranscode(net, job, session);
        return { kind: "paused", bytesDone: total };
      }

      try {
        await fh.write(chunk, 0, chunk.byteLength, total);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code === "ENOSPC" ? "disk-full" : "io";
        await fh.sync().catch(() => undefined);
        await fh.close();
        await killTranscode(net, job, session);
        return { kind: "failed", code, bytesDone: total };
      }
      total += chunk.byteLength;

      const now = Date.now();
      if (
        total - lastPersistBytes >= PERSIST_EVERY_BYTES ||
        now - lastPersistAt >= PERSIST_EVERY_MS
      ) {
        lastPersistBytes = total;
        lastPersistAt = now;
        onProgress(total);
      }
    }
  } catch {
    await fh.sync().catch(() => undefined);
    await fh.close();
    await killTranscode(net, job, session);
    // Flux coupé en cours de route : pause SYSTÈME, donc reprise automatique.
    return { kind: "failed", code: "network", bytesDone: total };
  }

  await killTranscode(net, job, session);
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
      await remove(part);
      return { kind: "failed", code: "integrity", bytesDone: 0 };
    }
  }
  if (total === 0) {
    await remove(part);
    return { kind: "failed", code: "integrity", bytesDone: 0 };
  }

  try {
    await rename(part, job.finalPath);
  } catch {
    return { kind: "failed", code: "io", bytesDone: total };
  }
  return { kind: "complete", finalSize: total };
}
