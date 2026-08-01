/**
 * Mise en file d'un lot : un film seul, ou une saison entière.
 *
 * Le refus est GLOBAL. Si l'espace libre — marge de 2 Gio comprise — ne couvre
 * pas le lot plus les transferts déjà promis, rien n'est mis en file. Accepter
 * la moitié d'une saison remplirait le disque au milieu, et l'utilisateur
 * découvrirait le problème six épisodes plus tard.
 *
 * Portage de `downloads_enqueue` (`engine_commands.rs`).
 */

import type { DatabaseSync } from "node:sqlite";
import { setAutoDelete } from "./listing";
import { upsertItemMeta } from "./meta";
import { hasCapacity } from "./paths";
import { pendingBytes } from "./queue";
import { claimOrCreateFile, findFile, setLightParams } from "./store";
import type { SubtitleSpec } from "./subs";

export interface EnqueueItem {
  itemId: string;
  mediaSourceId: string;
  variant: string;
  preset: string | null;
  containerExt: string;
  /** Taille EXACTE (Original seulement) — contrôle d'intégrité final. */
  expectedSize: number | null;
  /** Estimation pour le contrôle d'espace (Allégé : durée × débit × 1,15). */
  estimatedSize: number | null;
  kind: string;
  seriesId: string | null;
  seasonId: string | null;
  libraryId: string | null;
  runtimeTicks: number | null;
  title: string | null;
  seriesName: string | null;
  indexNumber: number | null;
  parentIndexNumber: number | null;
  autoDeleteAfterWatch: boolean;
  autoDeleteDelayMinutes: number;
  audioStreamIndex: number | null;
  burnSubtitleIndex: number | null;
  subtitles: SubtitleSpec[] | null;
}

export interface EnqueueOutcome {
  accepted: boolean;
  neededBytes: number;
  freeBytes: number;
  fileIds: number[];
}

/** Identifiant Jellyfin, tel qu'il peut entrer dans un chemin de fichier. */
function validId(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[A-Za-z0-9-]+$/.test(value);
}

/** Extension ou nom de preset : court, minuscule, alphanumérique. */
function validExt(value: string): boolean {
  return value.length >= 1 && value.length <= 5 && /^[a-z0-9]+$/.test(value);
}

/**
 * Valide le lot. Lève avec un code STABLE, consommé tel quel par l'interface.
 *
 * Ces identifiants finissent dans un NOM DE FICHIER : les valider ici est ce
 * qui empêche un serveur — le sien ou un autre — de faire écrire n'importe où.
 */
export function validateBatch(items: readonly EnqueueItem[]): void {
  if (items.length === 0) throw new Error("empty-batch");
  for (const item of items) {
    const ok =
      validId(item.itemId) &&
      validId(item.mediaSourceId) &&
      validExt(item.containerExt) &&
      (item.variant === "original" || item.variant === "light") &&
      (item.kind === "movie" || item.kind === "episode") &&
      (item.preset === null || validExt(item.preset));
    if (!ok) throw new Error("invalid-item");
  }
}

/** Chemin relatif du média, figé — le changer rendrait invisible l'existant. */
export function mediaRelPath(item: EnqueueItem): string {
  if (item.variant === "original") {
    return `media/${item.itemId}/original-${item.mediaSourceId}.${item.containerExt}`;
  }
  return `media/${item.itemId}/light-${item.mediaSourceId}-${item.preset ?? "p720"}.mp4`;
}

/**
 * Octets qu'il faudra trouver pour ce lot, transferts déjà promis compris.
 *
 * Un fichier existant et non annulé ne compte pas : on va s'y accrocher, pas
 * le retélécharger.
 */
export function neededBytesFor(db: DatabaseSync, items: readonly EnqueueItem[]): number {
  let needed = pendingBytes(db);
  for (const item of items) {
    const existing = findFile(db, item);
    const compte = existing === null || existing.status === "canceled";
    if (compte) needed += item.estimatedSize ?? item.expectedSize ?? 0;
  }
  return needed;
}

/** Met le lot en file, ou le refuse en bloc faute de place. */
export function enqueueBatch(
  db: DatabaseSync,
  userId: string,
  items: readonly EnqueueItem[],
  freeBytes: number,
  nowMs: number,
): EnqueueOutcome {
  validateBatch(items);

  const needed = neededBytesFor(db, items);
  if (needed > 0 && !hasCapacity(needed, freeBytes)) {
    return { accepted: false, neededBytes: needed, freeBytes, fileIds: [] };
  }

  const fileIds: number[] = [];
  for (const item of items) {
    upsertItemMeta(
      db,
      {
        itemId: item.itemId,
        kind: item.kind,
        seriesId: item.seriesId,
        seasonId: item.seasonId,
        libraryId: item.libraryId,
        runtimeTicks: item.runtimeTicks,
        title: item.title,
        seriesName: item.seriesName,
        indexNumber: item.indexNumber,
        parentIndexNumber: item.parentIndexNumber,
      },
      nowMs,
    );

    const outcome = claimOrCreateFile(db, {
      userId,
      itemId: item.itemId,
      mediaSourceId: item.mediaSourceId,
      variant: item.variant,
      preset: item.preset,
      relPath: mediaRelPath(item),
      expectedSize: item.expectedSize,
      autoDeleteAfterWatch: item.autoDeleteAfterWatch,
      nowMs,
    });

    const subtitlesJson =
      item.subtitles !== null && item.subtitles.length > 0 ? JSON.stringify(item.subtitles) : null;
    setLightParams(
      db,
      outcome.fileId,
      item.audioStreamIndex,
      item.burnSubtitleIndex,
      subtitlesJson,
    );

    // Appliqué même sur un claim préexistant : au re-téléchargement, c'est
    // l'intention exprimée dans le dialogue qui gagne.
    if (item.autoDeleteAfterWatch) {
      setAutoDelete(db, userId, outcome.fileId, true, item.autoDeleteDelayMinutes, nowMs);
    }
    fileIds.push(outcome.fileId);
  }

  return { accepted: true, neededBytes: needed, freeBytes, fileIds };
}
