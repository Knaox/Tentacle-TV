/**
 * Le travail d'UN transfert : photographier l'item, récupérer ses side-cars,
 * puis tirer le média.
 *
 * L'ordre compte. Le snapshot et les sous-titres passent AVANT le média : ce
 * sont quelques centaines de kilo-octets, et ils décident si la fiche sera
 * présentable hors ligne. Les faire après voudrait dire qu'un transfert
 * interrompu à 90 % laisse un film sans titre ni affiche.
 *
 * Portage de `run_worker` (`apps/desktop/src-tauri/src/downloads/engine.rs`).
 */

import type { DatabaseSync } from "node:sqlite";
import type { FetchBytes } from "./fetcher";
import { getSpec, snapshotExists } from "./meta";
import { safeJoin } from "./paths";
import { snapshot } from "./snapshot";
import type { FileRow } from "./store";
import { parseSpecs, fetchAll } from "./subs";
import { run, type TransferEnd, type TransferFlags, type TransferJob } from "./transfer";
import type { TransferNet } from "./transferNet";

export interface Creds {
  serverUrl: string;
  token: string;
}

export interface WorkerDeps {
  db: DatabaseSync;
  root: string;
  net: TransferNet;
  fetchBytes: FetchBytes;
  onProgress: (fileId: number, bytes: number) => void;
}

/** URL de téléchargement du média, selon la variante. */
export function mediaUrl(serverUrl: string, file: FileRow): string {
  if (file.variant === "original") {
    return `${serverUrl}/api/downloads/original/${file.itemId}?mediaSourceId=${file.mediaSourceId}`;
  }
  const preset = file.preset ?? "p720";
  let url =
    `${serverUrl}/api/downloads/light/${file.itemId}` +
    `?mediaSourceId=${file.mediaSourceId}&preset=${preset}`;
  if (file.audioStreamIndex !== null) url += `&audioStreamIndex=${file.audioStreamIndex}`;
  if (file.burnSubtitleIndex !== null) url += `&burnSubtitleIndex=${file.burnSubtitleIndex}`;
  return url;
}

export async function runWorker(
  deps: WorkerDeps,
  creds: Creds,
  file: FileRow,
  flags: TransferFlags,
  nowMs: number,
): Promise<TransferEnd> {
  // Les à-côtés sont best-effort : leur échec ne doit jamais empêcher le média
  // de se télécharger, et la réparation repassera derrière.
  if (!snapshotExists(deps.root, file.itemId)) {
    const spec = getSpec(deps.db, file.itemId);
    if (spec !== null) {
      try {
        await snapshot(deps.fetchBytes, deps.db, creds.serverUrl, deps.root, spec, nowMs);
      } catch {
        // Snapshot manqué : la fiche sera pauvre hors ligne, le film sera là.
      }
    }
  }

  if (file.subtitlesJson !== null) {
    const specs = parseSpecs(file.subtitlesJson);
    if (specs.length > 0) {
      try {
        await fetchAll(
          deps.fetchBytes,
          creds.serverUrl,
          deps.root,
          file.itemId,
          file.mediaSourceId,
          specs,
        );
      } catch {
        // Idem : sans sous-titres, le média reste lisible.
      }
    }
  }

  let finalPath: string;
  try {
    finalPath = safeJoin(deps.root, file.relPath);
  } catch {
    return { kind: "failed", code: "io", bytesDone: 0 };
  }

  const job: TransferJob = {
    url: mediaUrl(creds.serverUrl, file),
    token: creds.token,
    finalPath,
    variant: file.variant,
    expectedSize: file.expectedSize,
    serverUrl: creds.serverUrl,
  };
  return await run(deps.net, job, flags, (bytes) => deps.onProgress(file.id, bytes));
}
