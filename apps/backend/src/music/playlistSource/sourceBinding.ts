/**
 * Octave — QUEL titre de la source un élément de la playlist tient, par LA règle du cœur (`musicLibraryMatch.ts`,
 * `bestTrackMatch` : titre, artistes, durée, album), lue dans l'index local — aucune requête à Jellyfin.
 *
 * - Une insertion (`rankForInsert`) : le rang que l'extension donne fait foi quand le relevé vient de l'IMPORT (ses
 *   rangs sont ceux qu'elle a reçus) ; un relevé relu après coup (`repair`) le vérifie par la règle. Sans rang (une
 *   extension d'avant) : le titre de la source encore libre que l'élément est. Un élément qui est un titre DÉJÀ tenu
 *   (une autre version, la mise à niveau d'un fichier) y est lié, à la place que l'appelant a donnée.
 * - Une playlist d'avant (`bindEntries`, la réparation) : les liaisons connues d'abord, puis chaque titre de la
 *   source prend son meilleur élément libre, puis le monde clos (même titre de base, puis même durée :
 *   `sourceLooseMatch.ts`), puis chaque élément resté libre le titre qu'il est (un doublon, une autre version).
 */

import { bestTrackMatch } from "../contract/musicLibraryMatch";
import type { IndexRow } from "../index/indexTypes";
import { trackMatchable } from "../view/matchViews";
import { looseSlot, namedSlot, timedSlot } from "./sourceLooseMatch";
import { slotQuery, type PlaylistSourceRecord, type SourceSlot } from "./sourceRecord";

export interface InsertRank {
  rank: number;
  /** Faux : l'élément est une autre version d'un titre déjà là — lié, mais posé où l'appelant l'a demandé. */
  place: boolean;
}

/** Les titres de la source que cet élément est, dans l'ordre de la source. */
export function slotsMatching(slots: readonly SourceSlot[], row: IndexRow): SourceSlot[] {
  return slots.filter((slot) => bestTrackMatch(slotQuery(slot), [row], trackMatchable) !== null);
}

/** Le titre de la source qu'un élément inséré tient ; `row` : l'élément dans l'index (`null` : pas encore indexé). */
export function rankForInsert(record: PlaylistSourceRecord, row: IndexRow | null, hint?: number): InsertRank | null {
  const hinted = hint !== undefined && record.slots.some((s) => s.rank === hint) ? hint : null;
  if (hinted !== null && record.origin === "import") return { rank: hinted, place: true };
  const matches = row ? slotsMatching(record.slots, row) : [];
  const strict = matches.filter((s) => s.itemIds.length === 0);
  // Monde clos : une arrivée dans une playlist importée est l'un de SES titres encore libres (sourceLooseMatch.ts).
  const loose = strict.length === 0 && row ? looseSlot(record.slots.filter((s) => s.itemIds.length === 0), row) : null;
  const free = loose ? [loose] : strict;
  if (hinted !== null) return { rank: free.length === 0 || free.some((s) => s.rank === hinted) ? hinted : free[0]!.rank, place: true };
  if (free.length > 0) return { rank: free[0]!.rank, place: true };
  return matches.length > 0 ? { rank: matches[0]!.rank, place: false } : null;
}

/** Les titres de la source, chacun avec les éléments de la playlist (`itemIds`, dans son ordre) qui le tiennent. */
export function bindEntries(slots: readonly SourceSlot[], itemIds: readonly string[], rows: ReadonlyMap<string, IndexRow>): SourceSlot[] {
  const present = new Set(itemIds);
  const taken = new Set<string>();
  const out = slots.map((slot) => {
    const kept = slot.itemIds.filter((id) => present.has(id) && !taken.has(id));
    kept.forEach((id) => taken.add(id));
    return { ...slot, itemIds: kept };
  });
  const free = () => itemIds.filter((id) => !taken.has(id) && rows.has(id)).map((id) => rows.get(id)!);
  for (const slot of out) {
    if (slot.itemIds.length > 0) continue;
    const best = bestTrackMatch(slotQuery(slot), free(), trackMatchable);
    if (!best) continue;
    slot.itemIds.push(best.id);
    taken.add(best.id);
  }
  // Monde clos (sourceLooseMatch.ts) : le titre de base d'abord, pour tous ; puis la durée seule.
  for (const pick of [namedSlot, timedSlot]) {
    for (const row of free()) {
      const slot = pick(out.filter((s) => s.itemIds.length === 0), row);
      if (!slot) continue;
      slot.itemIds.push(row.id);
      taken.add(row.id);
    }
  }
  // Ce qui reste : un doublon, une autre version d'un titre déjà tenu (LA règle du cœur).
  for (const row of free()) {
    const slot = slotsMatching(out, row)[0];
    if (!slot) continue;
    slot.itemIds.push(row.id);
    taken.add(row.id);
  }
  return out;
}
