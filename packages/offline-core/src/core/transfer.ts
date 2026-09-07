/**
 * La POLITIQUE du transfert d'UN fichier : reprise, `.part`, intégrité,
 * classification des erreurs, arrêt du transcodage.
 *
 * Le MÉCANISME — lire un flux HTTP et l'écrire sur le disque — est l'affaire
 * du `TransferDriver` (voir `adapters.ts`) : sur le bureau, la boucle de blocs
 * de `node/streamDriver.ts` ; sur le mobile, le téléchargeur natif de la
 * plateforme. Ce fichier ne sait donc plus ni lire un flux ni ouvrir un
 * fichier : il décide, puis il CONSTATE sur le disque.
 *
 * Le renommage n'est pas un détail de rangement : tant que le fichier porte
 * `.part`, il n'est pas le fichier final, et rien ne peut le présenter comme
 * lisible. Un transfert interrompu ne laisse donc jamais un média à moitié
 * jouable.
 *
 * Reprise par plage d'octets pour l'Original — le backend relaie
 * `Accept-Ranges` de Jellyfin ; c'est le pilote qui pose l'en-tête. L'Allégé,
 * lui, est un transcodage : il n'est pas rejouable et repart toujours de zéro.
 *
 * Le jeton part en EN-TÊTE, jamais en query, et n'est jamais écrit sur le
 * disque.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/transfer.rs`.
 */

import type {
  Clock,
  FileStore,
  TranscodeSession,
  TransferDriver,
  TransferOutcome,
  TransferSignal,
  Volume,
} from "./adapters";

/** Cadence de persistance de la progression : au plus tôt des deux. */
const PERSIST_EVERY_BYTES = 4 * 1024 * 1024;
const PERSIST_EVERY_MS = 700;

/**
 * Bascules posées par le moteur.
 *
 * Observables : un pilote dont la lecture est bloquée sur un serveur muet doit
 * pouvoir être annulé sans attendre un bloc qui ne viendra pas.
 */
export class TransferFlags implements TransferSignal {
  private cancelFlag = false;
  private pauseFlag = false;
  private readonly listeners = new Set<() => void>();

  get cancel(): boolean {
    return this.cancelFlag;
  }

  set cancel(value: boolean) {
    this.cancelFlag = value;
    this.notify();
  }

  get pause(): boolean {
    return this.pauseFlag;
  }

  set pause(value: boolean) {
    this.pauseFlag = value;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export type TransferEnd =
  | { kind: "complete"; finalSize: number }
  | { kind: "paused"; bytesDone: number }
  | { kind: "canceled" }
  /** Codes STABLES, consommés par l'interface. */
  | {
      kind: "failed";
      code: "network" | "disk-full" | "integrity" | "unavailable" | "io" | "finalize";
      bytesDone: number;
    };

export interface TransferJob {
  url: string;
  token: string;
  /** Chemin STORE du fichier final (absolu, ou `file://` sur mobile). Le `.part` en dérive. */
  finalPath: string;
  variant: string;
  expectedSize: number | null;
  /** Base du serveur Tentacle — arrêt propre du transcodage Allégé. */
  serverUrl: string;
  /**
   * Session de transcodage choisie par le CLIENT (Allégé), pour les pilotes
   * qui ne livrent pas les en-têtes de réponse avant la fin. Les en-têtes,
   * quand ils arrivent, la remplacent.
   */
  transcodeSession: TranscodeSession | null;
}

function transcodeUrl(job: TransferJob, session: TranscodeSession): string {
  return (
    `${job.serverUrl}/api/jellyfin/Videos/ActiveEncodings` +
    `?deviceId=${session.deviceId}&playSessionId=${session.playSessionId}`
  );
}

/** Jette un `.part` ; déjà absent ou verrouillé : rien de mieux à faire ici. */
function discard(files: FileStore, part: string): void {
  try {
    files.remove(part);
  } catch {
    // Un `.part` qui reste sera jeté au prochain passage.
  }
}

/**
 * Exécute le transfert. `onProgress` est déjà étranglé par cette fonction.
 *
 * Ne lève jamais : toute sortie est un `TransferEnd`, parce que l'appelant doit
 * pouvoir écrire un statut en base dans tous les cas.
 */
export async function run(
  driver: TransferDriver,
  volume: Volume,
  job: TransferJob,
  flags: TransferFlags,
  onProgress: (bytes: number) => void,
  now: Clock,
  onExpected?: (totalBytes: number) => void,
): Promise<TransferEnd> {
  const { files } = volume;
  const part = `${job.finalPath}.part`;

  // Le dossier de l'item n'existe pas au premier transfert, et RIEN d'autre ne
  // le crée : `ensureLayout` ne pose que `media/` et `meta/` à la racine, et
  // `meta`, `subs` et `trickplay` créent chacun LEUR dossier, jamais celui du
  // média. Sans cette ligne, l'ouverture du `.part` échoue et TOUT
  // téléchargement se solde par un `io` à zéro octet.
  //
  // Même geste que `transfer.rs:85`, que le portage avait perdu — et que les
  // tests ne pouvaient pas voir : leur fixture créait le dossier elle-même.
  try {
    files.mkdirp(files.dirname(job.finalPath));
  } catch {
    return { kind: "failed", code: "io", bytesDone: 0 };
  }

  // Reprise : Original uniquement. Un transcodage n'est pas rejouable, et
  // reprendre son flux à mi-course donnerait un fichier incohérent.
  let resumeFrom = 0;
  if (job.variant === "original") {
    resumeFrom = files.size(part) ?? 0;
  } else {
    discard(files, part);
    driver.forget?.(part);
  }

  // Session capturée par les en-têtes dès qu'ils arrivent — AVANT la
  // consommation du corps sur le bureau —, à défaut celle du client : il faut
  // pouvoir l'arrêter à toute sortie.
  let session: TranscodeSession | null = job.transcodeSession;
  let total = resumeFrom;
  let lastTotal = 0;
  let lastPersistBytes = resumeFrom;
  let lastPersistAt = now();

  let outcome: TransferOutcome;
  try {
    outcome = await driver.download({
      url: job.url,
      headers: { Authorization: `Bearer ${job.token}` },
      partPath: part,
      resumeFrom,
      signal: flags,
      onBytes: (bytes) => {
        total = bytes;
        const at = now();
        if (total - lastPersistBytes >= PERSIST_EVERY_BYTES || at - lastPersistAt >= PERSIST_EVERY_MS) {
          lastPersistBytes = total;
          lastPersistAt = at;
          onProgress(total);
        }
      },
      onTotal: (totalBytes) => {
        // Une seule remontée par valeur : le pilote mobile l'annonce à CHAQUE
        // bloc reçu, et une écriture en base par bloc n'aurait aucun sens.
        if (totalBytes > 0 && totalBytes !== lastTotal) {
          lastTotal = totalBytes;
          onExpected?.(totalBytes);
        }
      },
      onHeaders: (_status, header) => {
        const play = header("x-tentacle-play-session");
        const device = header("x-tentacle-device-id");
        if (play !== null && device !== null) session = { playSessionId: play, deviceId: device };
      },
    });
  } catch {
    // Un pilote qui lève ne doit pas laisser le fichier en `downloading`.
    outcome = { kind: "failed", cause: "io", bytesKnown: total };
  }

  // Fin de session serveur, best-effort, à TOUTE sortie : libère ffmpeg et les
  // fichiers temporaires côté Jellyfin, que le transfert ait abouti, été
  // annulé ou mis en pause. Sans cet appel, un transcodage abandonné continue
  // de tourner.
  const stopTranscode = async (): Promise<void> => {
    if (session === null) return;
    await driver.stopTranscode(transcodeUrl(job, session), { "X-Emby-Token": job.token });
  };

  switch (outcome.kind) {
    case "canceled":
      discard(files, part);
      await stopTranscode();
      return { kind: "canceled" };
    case "paused":
      await stopTranscode();
      // iOS ne pose le `.part` qu'à la fin : le compte du pilote fait foi.
      return { kind: "paused", bytesDone: files.size(part) ?? outcome.bytesKnown };
    case "failed":
      await stopTranscode();
      if (outcome.cause === "range-ignored") {
        // Le pilote n'a pas pu tronquer : on repart de zéro, en pause SYSTÈME,
        // donc reprise automatique.
        discard(files, part);
        return { kind: "failed", code: "network", bytesDone: 0 };
      }
      return { kind: "failed", code: outcome.cause, bytesDone: files.size(part) ?? outcome.bytesKnown };
    case "done":
      break;
  }

  if (outcome.status >= 400) {
    await stopTranscode();
    const code =
      outcome.status === 404 || outcome.status === 403 || outcome.status === 401
        ? "unavailable"
        : "network";
    // Un pilote natif peut avoir écrit le corps de l'erreur dans le `.part` :
    // ce qui dépasse la reprise n'est pas du média, on le jette.
    if ((files.size(part) ?? 0) !== resumeFrom) {
      discard(files, part);
      return { kind: "failed", code, bytesDone: 0 };
    }
    return { kind: "failed", code, bytesDone: resumeFrom };
  }

  await stopTranscode();
  const written = files.size(part) ?? 0;

  // Intégrité : l'Original doit faire EXACTEMENT la taille annoncée. Sinon le
  // fichier source a changé en cours de route, et on repart propre plutôt que
  // de présenter comme lisible un média tronqué.
  if (job.variant === "original" && job.expectedSize !== null && job.expectedSize > 0) {
    if (written !== job.expectedSize) {
      discard(files, part);
      return { kind: "failed", code: "integrity", bytesDone: 0 };
    }
  }
  if (written === 0) {
    discard(files, part);
    return { kind: "failed", code: "integrity", bytesDone: 0 };
  }

  try {
    files.rename(part, job.finalPath);
  } catch {
    return { kind: "failed", code: "io", bytesDone: written };
  }
  return { kind: "complete", finalSize: written };
}
