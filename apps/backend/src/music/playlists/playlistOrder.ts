/**
 * Octave — l'ordre d'une playlist Jellyfin, réécrit par la FIN. Pur.
 *
 * Relevés du banc (Jellyfin 10.11.11, 2026-10-24, confirmés par A5) :
 * - `POST /Playlists/{id}/Items` n'ajoute qu'à la FIN (pas de position) ; avec
 *   la clé + `userId`, Jellyfin y applique les droits du compte (404/403) ;
 * - `…/Move/{index}` exige un utilisateur CONNECTÉ : la clé reçoit un 400 ;
 * - `DELETE …/Items?entryIds=` IGNORE `userId` : la clé retire d'une playlist
 *   de n'importe qui — le droit se vérifie donc AVANT (`playlistService.ts`) ;
 * - un élément déjà présent n'est jamais ajouté deux fois.
 *
 * Insérer à `position` ou déplacer, c'est donc : connaître l'ordre VOULU, puis
 * retirer les entrées à partir du premier rang qui diffère et remettre la fin
 * voulue. La tête ne bouge jamais.
 */

import { applyCustomOrder } from "../contract/musicListOrder";

export interface PlaylistEntryRef {
  entryId: string;
  itemId: string;
}

export interface TailRewrite {
  /** Les entrées (identifiants d'entrée Jellyfin) à retirer, du premier rang qui diffère à la fin. */
  remove: string[];
  /** Les éléments à rajouter, dans l'ordre, après la tête gardée. */
  append: string[];
}

/** L'ordre voulu après l'insertion de `itemIds` à `position` (0 = tête ; absente ou au-delà = fin). */
export function insertedOrder(current: readonly PlaylistEntryRef[], itemIds: readonly string[], position?: number): string[] {
  const at = position === undefined ? current.length : Math.max(0, Math.min(Math.floor(position), current.length));
  const inserted = [...new Set(itemIds)];
  const moving = new Set(inserted);
  // Un titre inséré qui était déjà là change de place : il n'y est qu'une fois (Jellyfin dédoublonne).
  const head = current.slice(0, at).map((e) => e.itemId).filter((id) => !moving.has(id));
  const tail = current.slice(at).map((e) => e.itemId).filter((id) => !moving.has(id));
  return [...head, ...inserted, ...tail];
}

/** L'ordre voulu après le déplacement de `entryId` au rang `newIndex` ; `null` si l'entrée n'existe pas. */
export function movedOrder(current: readonly PlaylistEntryRef[], entryId: string, newIndex: number): string[] | null {
  const from = current.findIndex((e) => e.entryId === entryId);
  if (from < 0) return null;
  const ids = current.map((e) => e.itemId);
  const [moved] = ids.splice(from, 1);
  ids.splice(Math.max(0, Math.min(Math.floor(newIndex), ids.length)), 0, moved!);
  return ids;
}

/**
 * L'ordre voulu quand le client envoie l'ordre COMPLET de ses entrées (glisser dans Octave). Une entrée
 * qu'il ne connaissait pas (ajoutée entre-temps) reste juste après son prédécesseur ; une entrée qu'il
 * cite et qui n'existe plus est ignorée.
 */
export function reorderedOrder(current: readonly PlaylistEntryRef[], entryIds: readonly string[]): string[] {
  const subject = (e: PlaylistEntryRef) => ({ key: e.entryId, title: "", artist: "", album: "", disc: null, track: null, durationMs: null, year: null, recording: null, stats: null });
  return applyCustomOrder(current, subject, entryIds.map((k) => ({ k }))).map((e) => e.itemId);
}

/** Des lots bornés : Jellyfin (Kestrel) refuse une ligne de requête de plus de 8 Kio. */
export function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Ce qu'il faut retirer et rajouter pour passer de `current` à `desired` ; `null` s'ils sont égaux. */
export function planRewrite(current: readonly PlaylistEntryRef[], desired: readonly string[]): TailRewrite | null {
  let start = 0;
  while (start < current.length && start < desired.length && current[start]!.itemId === desired[start]) start++;
  if (start === current.length && start === desired.length) return null;
  return { remove: current.slice(start).map((e) => e.entryId), append: desired.slice(start) };
}
