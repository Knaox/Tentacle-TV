/**
 * Le travail d'UN transfert : photographier l'item, récupérer ses side-cars,
 * puis tirer le média.
 *
 * L'ordre compte. Le média est confié au pilote D'ABORD, puis le snapshot et
 * les sous-titres partent PENDANT qu'il avance. Ils passaient avant : sur
 * l'iPhone, l'application quittée juste après « Garder hors ligne », le
 * JavaScript était suspendu au milieu d'une extraction de sous-titres, et le
 * média n'était JAMAIS remis à la session d'arrière-plan — « tout s'arrête
 * à la préparation » (alpha mobile, 21/10). Quelques centaines de kilo-octets,
 * ils arrivent bien avant le média ; un transfert interrompu à 90 % garde donc
 * sa fiche présentable comme avant.
 *
 * Portage de `run_worker` (`apps/desktop/src-tauri/src/downloads/engine.rs`).
 */

import type { Clock, DatabaseHandle, TransferDriver, Volume } from "./adapters";
import type { FetchBytes } from "./fetcher";
import { getSpec, snapshotExists } from "./meta";
import { fetchMusicCover } from "./musicLibrary";
import { safeJoin } from "./paths";
import { snapshot } from "./snapshot";
import { setSubtitlesDone, type FileRow } from "./store";
import { parseSpecs, fetchAll } from "./subs";
import { run, type TransferEnd, type TransferFlags, type TransferJob } from "./transfer";

export interface Creds {
  serverUrl: string;
  token: string;
}

export interface WorkerDeps {
  db: DatabaseHandle;
  volume: Volume;
  driver: TransferDriver;
  fetchBytes: FetchBytes;
  /** Sans jeton : la pochette https d'un titre hors bibliothèque (null : pas gardée). */
  fetchPublic?: FetchBytes | null;
  onProgress: (fileId: number, bytes: number) => void;
  /** Le pilote a annoncé le total attendu — voir `TransferRequest.onTotal`. */
  onExpected: (fileId: number, totalBytes: number) => void;
  /** Le statut de la réponse du serveur — voir `TransferHooks.onResponse`. */
  onResponse?: ((fileId: number, status: number) => void) | undefined;
  /** Trace d'une défaillance inattendue — voir `EngineDeps.onUnexpected`. */
  onUnexpected?: ((context: string, error: unknown) => void) | undefined;
  /** La préparation tenue par le serveur — voir `EngineDeps.serverPrepare`. */
  serverPrepare?: ServerPrepare | null | undefined;
  now: Clock;
}

/** La préparation tenue par le serveur (`offline.serverPrepare`), quand il la sait faire. */
export interface ServerPrepare {
  /** L'étiquette de CET appareil : seule une préparation qu'il a déjà lue lui est reprise par plage. */
  tag: string;
}

/** Les paramètres d'un fichier Allégé : palier et pistes. */
function lightQuery(file: FileRow): string {
  let query = `?mediaSourceId=${file.mediaSourceId}&preset=${file.preset ?? "p720"}`;
  if (file.audioStreamIndex !== null) query += `&audioStreamIndex=${file.audioStreamIndex}`;
  if (file.burnSubtitleIndex !== null) query += `&burnSubtitleIndex=${file.burnSubtitleIndex}`;
  return query;
}

/**
 * URL de téléchargement du média, selon la variante. Un Allégé passe par la
 * préparation du serveur quand il la sait faire (`prepared`), sinon par le
 * transcodage tiré en direct (`light`).
 */
export function mediaUrl(serverUrl: string, file: FileRow, prepare: ServerPrepare | null = null): string {
  // Un titre de musique dit lui-même d'où le tirer (la bibliothèque, ou la route d'une extension).
  if (file.sourcePath !== null) return `${serverUrl}${file.sourcePath}`;
  if (file.variant === "original") {
    return `${serverUrl}/api/downloads/original/${file.itemId}?mediaSourceId=${file.mediaSourceId}`;
  }
  if (prepare !== null) {
    return `${serverUrl}/api/downloads/prepared/${file.itemId}${lightQuery(file)}&tag=${encodeURIComponent(prepare.tag)}`;
  }
  return `${serverUrl}/api/downloads/light/${file.itemId}${lightQuery(file)}`;
}

/** Ce que le serveur efface quand le fichier est chez nous : la préparation de CE fichier. */
export function preparedReleaseUrl(serverUrl: string, file: FileRow): string {
  return `${serverUrl}/api/downloads/prepared/${file.itemId}${lightQuery(file)}`;
}

export async function runWorker(
  deps: WorkerDeps,
  creds: Creds,
  file: FileRow,
  flags: TransferFlags,
  nowMs: number,
): Promise<TransferEnd> {
  let finalPath: string;
  try {
    finalPath = safeJoin(deps.volume, file.relPath);
  } catch {
    return { kind: "failed", code: "io", bytesDone: 0 };
  }

  const prepare = file.variant === "original" || file.sourcePath !== null ? null : (deps.serverPrepare ?? null);
  const job: TransferJob = {
    url: mediaUrl(creds.serverUrl, file, prepare),
    token: creds.token,
    finalPath,
    variant: file.variant,
    expectedSize: file.expectedSize,
    serverUrl: creds.serverUrl,
    // Le bureau lit la session dans les en-têtes de réponse ; le client n'en
    // choisit pas encore. La préparation du serveur n'en a pas : elle est à lui.
    transcodeSession: null,
    resumable: file.variant === "original" || prepare !== null,
    releaseUrl: prepare === null ? null : preparedReleaseUrl(creds.serverUrl, file),
  };
  // Le média d'abord : remis au pilote (la session d'arrière-plan d'iOS) avant
  // le moindre aller-retour des à-côtés — voir l'en-tête.
  const media = run(
    deps.driver,
    deps.volume,
    job,
    flags,
    (bytes) => deps.onProgress(file.id, bytes),
    deps.now,
    {
      onExpected: (totalBytes) => deps.onExpected(file.id, totalBytes),
      onResponse: (status) => deps.onResponse?.(file.id, status),
      onUnexpected: deps.onUnexpected,
    },
  );
  await fetchSidecars(deps, creds, file, nowMs);
  return await media;
}

/** Snapshot et sous-titres, best-effort : leur échec n'empêche jamais le média. */
async function fetchSidecars(deps: WorkerDeps, creds: Creds, file: FileRow, nowMs: number): Promise<void> {
  // Un titre de musique : sa pochette seulement (aucune fiche Jellyfin, aucun sous-titre).
  if (file.sourcePath !== null) {
    try {
      await fetchMusicCover(deps.fetchBytes, deps.db, creds.serverUrl, deps.volume, file.itemId, deps.fetchPublic ?? null);
    } catch {
      // Sans pochette, le titre reste lisible.
    }
    return;
  }
  // La réparation repassera derrière ce qui manque.
  if (!snapshotExists(deps.volume, file.itemId)) {
    const spec = getSpec(deps.db, file.itemId);
    if (spec !== null) {
      try {
        await snapshot(deps.fetchBytes, deps.db, creds.serverUrl, deps.volume, spec, nowMs);
      } catch {
        // Snapshot manqué : la fiche sera pauvre hors ligne, le film sera là.
      }
    }
  }

  if (file.subtitlesJson !== null) {
    const specs = parseSpecs(file.subtitlesJson);
    if (specs.length > 0) {
      try {
        const fetched = await fetchAll(
          deps.fetchBytes,
          creds.serverUrl,
          deps.volume,
          file.itemId,
          file.mediaSourceId,
          specs,
          // Une piste sautée ne disparaît plus sans un mot : le serveur met
          // parfois plus de vingt secondes à extraire un sous-titre, et le
          // fetcher n'en rend qu'un `null` muet.
          (spec, reason) => deps.onUnexpected?.("subs.fetch", `${file.itemId} piste ${spec.index} (${spec.langTag}) : ${reason}`),
        );
        setSubtitlesDone(deps.db, file.itemId, file.mediaSourceId, fetched);
      } catch {
        // Idem : sans sous-titres, le média reste lisible.
      }
    }
  }

}
