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
import { isPausedByUser, setBytesDone, setPausedByUser, setPhase, setStatus } from "./queue";
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

/**
 * Taille du média déjà reçu si ce fichier n'attend PLUS que son remux, `null`
 * sinon. Une phase `finalize` dont le fichier a disparu est effacée : le
 * transfert repart alors normalement.
 */
export function mediaAwaitingFinalize(
  db: DatabaseHandle,
  volume: Volume,
  file: { id: number; phase: string | null; relPath: string },
  nowMs: number,
): number | null {
  if (file.phase !== "finalize") return null;
  const size = volume.files.size(safeJoin(volume, file.relPath));
  if (size !== null) return size;
  setPhase(db, file.id, null, nowMs);
  return null;
}

/**
 * Voir `EngineDeps.finalizeMedia` : la taille finale est relue après le remux.
 *
 * La phase et la taille reçue sont écrites AVANT l'appel natif. C'est ce qui
 * rend l'échec réparable : le média est déjà renommé en fichier final (le
 * remux travaille sur un temporaire à côté), donc un remux raté laisse un
 * fichier complet — le retélécharger coûterait des centaines de mégaoctets
 * pour rien. Et la phase survit à un arrêt de l'application.
 */
export async function runFinalize(
  db: DatabaseHandle,
  volume: Volume,
  fileId: number,
  finalizeMedia: (absPath: string, file: { variant: string; relPath: string }) => Promise<void>,
  file: { variant: string; relPath: string },
  finalSize: number,
  nowMs: number,
): Promise<TransferEnd> {
  const target = safeJoin(volume, file.relPath);
  setPhase(db, fileId, "finalize", nowMs);
  setBytesDone(db, fileId, finalSize, nowMs);
  try {
    await finalizeMedia(target, file);
    setPhase(db, fileId, null, nowMs);
    return { kind: "complete", finalSize: volume.files.size(target) ?? finalSize };
  } catch {
    // La phase RESTE `'finalize'` : la reprise sautera le téléchargement.
    return { kind: "failed", code: "finalize", bytesDone: volume.files.size(target) ?? finalSize };
  }
}
