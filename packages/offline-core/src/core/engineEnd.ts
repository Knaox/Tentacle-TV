/**
 * La fin d'un transfert : sa traduction en statut, et la finalisation du
 * fichier Allégé qui la précède parfois.
 *
 * Deux fonctions sans état, sorties de l'orchestrateur — c'est ici que se
 * décide ce qu'un utilisateur voit après une coupure, un disque plein ou un
 * remux raté, et ça se relit mieux loin de la mécanique de la file.
 */

import type { DatabaseHandle, Volume } from "./adapters";
import { safeJoin } from "./paths";
import { isPausedByUser, setBytesDone, setPausedByUser, setStatus } from "./queue";
import type { TransferEnd } from "./transfer";

export interface EndContext {
  nowMs: number;
  /** Entre `suspendForSystem` et `resumeSystemPauses` : les conditions manquent. */
  systemSuspended: boolean;
  canTransfer?: (() => boolean) | undefined;
}

/** Traduit une fin de transfert en statut de base. */
export function applyEnd(db: DatabaseHandle, fileId: number, end: TransferEnd, ctx: EndContext): void {
  const now = ctx.nowMs;
  switch (end.kind) {
    case "complete":
      setBytesDone(db, fileId, end.finalSize, now);
      setStatus(db, fileId, "complete", null, now);
      break;
    case "paused":
      setBytesDone(db, fileId, end.bytesDone, now);
      // Une pause SYSTÈME qui aboutit APRÈS le retour des conditions : la
      // relance n'avait rien trouvé à relancer (le transfert se mettait
      // encore en pause) — sans ceci, la ligne attendait le prochain
      // évènement. Une pause explicite reste en pause.
      if (!isPausedByUser(db, fileId) && !ctx.systemSuspended && ctx.canTransfer?.() !== false) {
        setStatus(db, fileId, "queued", null, now);
      } else {
        setStatus(db, fileId, "paused", null, now);
      }
      break;
    case "canceled":
      setBytesDone(db, fileId, 0, now);
      setStatus(db, fileId, "canceled", null, now);
      break;
    case "failed":
      setBytesDone(db, fileId, end.bytesDone, now);
      if (end.code === "network") {
        // Coupure réseau = pause SYSTÈME, donc reprise automatique au retour.
        // La marquer `error` demanderait un geste à l'utilisateur pour un
        // incident qui se résout tout seul.
        setPausedByUser(db, fileId, false);
        setStatus(db, fileId, "paused", null, now);
      } else {
        setStatus(db, fileId, "error", end.code, now);
      }
      break;
  }
}

/** Voir `EngineDeps.finalizeMedia` : la taille finale est relue après le remux. */
export async function runFinalize(
  volume: Volume,
  finalizeMedia: (absPath: string, file: { variant: string; relPath: string }) => Promise<void>,
  file: { variant: string; relPath: string; bytesDone: number },
  finalSize: number,
): Promise<TransferEnd> {
  try {
    const target = safeJoin(volume, file.relPath);
    await finalizeMedia(target, file);
    return { kind: "complete", finalSize: volume.files.size(target) ?? finalSize };
  } catch {
    return { kind: "failed", code: "io", bytesDone: file.bytesDone };
  }
}
