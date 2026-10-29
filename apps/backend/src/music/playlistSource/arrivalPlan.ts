/**
 * Octave — QUELS titres d'une source une arrivée dans la bibliothèque vient tenir (pur).
 *
 * Un titre absent à l'import (Damien, 29/10 : un album importé à la main, une playlist Spotify qui en a des titres)
 * puis arrivé dans la bibliothèque — importé à la main, livré par Lidarr, mis là par une extension — tient le titre
 * ENCORE LIBRE de la source qu'il est, par LA règle du cœur (`bestTrackMatch` : titre de base, artiste commun, durée
 * d'un autre master au plus). Jamais le monde clos (`sourceLooseMatch.ts`) : n'importe quelle arrivée de la
 * bibliothèque n'est pas un titre de CETTE playlist, et une durée proche ne suffit pas à le dire.
 *
 * Chaque titre libre, dans l'ordre de la source, prend sa meilleure arrivée ; une arrivée ne tient qu'un titre.
 */

import { bestTrackMatch } from "../contract/musicLibraryMatch";
import type { IndexRow } from "../index/indexTypes";
import { trackMatchable } from "../view/matchViews";
import { slotQuery, type SourceSlot } from "./sourceRecord";

export interface ArrivalBinding {
  rank: number;
  itemId: string;
}

/** Les titres encore libres que tiennent ces arrivées (des titres, pas des albums), dans l'ordre de la source. */
export function arrivalBindings(slots: readonly SourceSlot[], arrivals: readonly IndexRow[]): ArrivalBinding[] {
  const held = new Set(slots.flatMap((s) => s.itemIds));
  const free = arrivals.filter((row) => row.kind === "track" && !held.has(row.id));
  const out: ArrivalBinding[] = [];
  for (const slot of [...slots].sort((a, b) => a.rank - b.rank)) {
    if (slot.itemIds.length > 0 || free.length === 0) continue;
    const best = bestTrackMatch(slotQuery(slot), free, trackMatchable);
    if (!best) continue;
    out.push({ rank: slot.rank, itemId: best.id });
    free.splice(free.indexOf(best), 1);
  }
  return out;
}

/** Un relevé a-t-il encore un titre que rien ne tient ? */
export function hasFreeSlot(slots: readonly SourceSlot[]): boolean {
  return slots.some((s) => s.itemIds.length === 0);
}
