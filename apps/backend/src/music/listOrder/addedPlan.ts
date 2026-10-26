/**
 * Octave — QUAND un titre est entré dans une liste (pur). Jellyfin ne date ni
 * un favori ni une entrée de playlist : Tentacle relève la date à la première
 * lecture qui voit le titre, et l'oublie quand le titre quitte la liste (un
 * titre retiré puis remis repart de sa nouvelle date, comme ailleurs).
 *
 * La PREMIÈRE lecture d'une liste ne sait rien de son passé : elle ESTIME
 * (l'ordre de la playlist, qui est celui des ajouts tant qu'on ne l'a pas
 * réordonnée ; l'ajout à la bibliothèque pour un like), toujours avant
 * l'instant présent, pour que « Dernier ajout » garde un sens dès le départ.
 */

export interface AddedPlan {
  /** La date d'entrée de chaque titre (ms). */
  dates: Map<string, number>;
  insert: { itemId: string; addedAt: number }[];
  remove: string[];
}

/**
 * `ids` : la liste dans son ordre naturel (une playlist : son ordre ; les likés : quelconque).
 * `estimate` : la date estimée d'un titre à la première lecture (`null` : déduite de son rang).
 */
export function planAddedDates(
  known: ReadonlyMap<string, number>,
  ids: readonly string[],
  now: number,
  estimate: (itemId: string, index: number) => number | null,
): AddedPlan {
  const dates = new Map<string, number>();
  const insert: AddedPlan["insert"] = [];
  const first = known.size === 0;
  let fresh = 0;
  ids.forEach((id, index) => {
    if (dates.has(id)) return;
    const seen = known.get(id);
    if (seen !== undefined) {
      dates.set(id, seen);
      return;
    }
    // Les nouveaux d'une même lecture : dans l'ordre de la liste (le dernier de la playlist est le plus récent).
    const at = first ? Math.min(estimate(id, index) ?? now - (ids.length - index), now - (ids.length - index)) : now + fresh++;
    dates.set(id, at);
    insert.push({ itemId: id, addedAt: at });
  });
  const remove = ids.length === 0 ? [] : [...known.keys()].filter((id) => !dates.has(id));
  return { dates, insert, remove };
}
