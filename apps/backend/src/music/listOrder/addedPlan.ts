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
 *
 * Une playlist (`ordered`) : un ajout va en FIN de liste. Un titre nouveau
 * apparu AVANT un titre connu n'a pas été ajouté maintenant : il a été POSÉ
 * à la place d'un autre — l'arrivée dans la bibliothèque d'une attente
 * importée, que l'extension insère à sa place (Damien, 27/10 : « Derniers
 * ajouts » montrait l'arrivée de Lidarr, pas l'ajout à la playlist). Il prend
 * la date de l'entrée qui le précède ; l'ordre de la playlist départage.
 *
 * Une playlist IMPORTÉE (`pinned`, 27/10) : un titre de la source a la date de
 * son RANG dans la source — pour Apple Music, l'ordre des ajouts —, qui
 * remplace toute date relevée ou estimée d'après l'ordre de Jellyfin (faux
 * avant la 1.40.0). Un titre hors source garde la règle ordinaire, les titres
 * de la source servant de repères : un vrai ajout fait ensuite reste daté
 * « maintenant ».
 */

export interface AddedPlan {
  /** La date d'entrée de chaque titre (ms). */
  dates: Map<string, number>;
  /** `replace` : une date relevée remplacée (celle d'un titre de la source, qui fait foi). */
  insert: { itemId: string; addedAt: number; replace?: boolean }[];
  remove: string[];
}

export interface AddedPlanOptions {
  /** L'ordre de `ids` est celui des ajouts (une playlist) ; les likés n'en ont pas. */
  ordered?: boolean;
  /** Les dates qui font foi : le rang dans la source d'un titre d'une playlist importée (`playlistSource/`). */
  pinned?: ReadonlyMap<string, number>;
}

/** Le rang du dernier titre déjà daté : avant lui, un nouveau a été posé, pas ajouté. */
function lastKnownIndex(known: ReadonlyMap<string, number>, ids: readonly string[]): number {
  for (let i = ids.length - 1; i >= 0; i -= 1) if (known.has(ids[i]!)) return i;
  return -1;
}

/** La date de l'entrée qui précède `index` (celle qui suit s'il n'y en a pas). */
function neighbourDate(known: ReadonlyMap<string, number>, dates: ReadonlyMap<string, number>, ids: readonly string[], index: number): number | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const at = dates.get(ids[i]!);
    if (at !== undefined) return at;
  }
  for (let i = index + 1; i < ids.length; i += 1) {
    const at = known.get(ids[i]!);
    if (at !== undefined) return at;
  }
  return undefined;
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
  options: AddedPlanOptions = {},
): AddedPlan {
  const dates = new Map<string, number>();
  const insert: AddedPlan["insert"] = [];
  const first = known.size === 0;
  const pinned = options.pinned ?? new Map<string, number>();
  // Les titres de la source sont des repères, même à la première lecture.
  const anchors = pinned.size > 0 ? new Map([...known, ...pinned]) : known;
  const placedBefore = options.ordered ? lastKnownIndex(anchors, ids) : -1;
  let fresh = 0;
  ids.forEach((id, index) => {
    if (dates.has(id)) return;
    const seen = known.get(id);
    const fixed = pinned.get(id);
    if (fixed !== undefined) {
      dates.set(id, fixed);
      if (seen !== fixed) insert.push({ itemId: id, addedAt: fixed, replace: seen !== undefined });
      return;
    }
    if (seen !== undefined) {
      dates.set(id, seen);
      return;
    }
    let at: number;
    // Posé avant un titre connu : à la date de sa place (jamais « maintenant »).
    if (index < placedBefore && (!first || pinned.size > 0)) at = neighbourDate(anchors, dates, ids, index) ?? now + fresh++;
    else if (first) at = Math.min(estimate(id, index) ?? now - (ids.length - index), now - (ids.length - index));
    // Les nouveaux d'une même lecture : dans l'ordre de la liste (le dernier de la playlist est le plus récent).
    else at = now + fresh++;
    dates.set(id, at);
    insert.push({ itemId: id, addedAt: at });
  });
  const remove = ids.length === 0 ? [] : [...known.keys()].filter((id) => !dates.has(id));
  return { dates, insert, remove };
}
