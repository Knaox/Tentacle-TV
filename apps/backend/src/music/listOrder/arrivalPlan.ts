/**
 * Octave — la date d'entrée d'un titre que l'EXTENSION pose dans une playlist (`jellyfin.playlistInsert`). Pur.
 *
 * Lot fl (30/10, Damien : « en tri Derniers ajouts, un titre récent se déplace quand je le garde hors ligne ») :
 * la copie gardée hors ligne permet à l'extension de faire ENTRER le titre dans la bibliothèque (le repli de
 * Lidarr), puis Lidarr le remplace par la vraie parution — un NOUVEL élément Jellyfin, réinséré à la même place.
 * Posé en fin de playlist, `addedPlan.ts` datait cet élément « maintenant » à la lecture suivante : le titre
 * sautait en tête, au-dessus des titres ajoutés APRÈS lui. Une insertion de l'extension n'est jamais un ajout de
 * l'utilisateur : c'est une attente qui arrive, ou un élément qui en remplace un autre.
 *
 * - Un élément qui en REMPLACE un autre de la playlist (même enregistrement, ou même « titre | artiste » :
 *   `listAlias`) hérite de sa date — la mise à niveau d'un fichier.
 * - Sinon il prend la date de l'entrée datée qui le PRÉCÈDE à sa place (celle qui suit s'il n'y en a pas) : le
 *   client datait l'attente de la même façon (`listStats.ts`), rien ne bouge à son arrivée.
 * - Une playlist jamais lue (aucune date) : rien, sa première lecture estime tout d'après son ordre.
 */

export interface ArrivalInput {
  /** Les dates connues de la playlist (`music_list_added`). */
  known: ReadonlyMap<string, number>;
  /** Les éléments de la playlist AVANT l'insertion, dans son ordre. */
  before: readonly string[];
  /** Les éléments posés (dans l'ordre), et leur place dans la playlist d'après. */
  inserted: readonly string[];
  at: number;
  /** L'identité d'un élément (`listAlias`) ; `null` si l'index ne le connaît pas. */
  identity: (itemId: string) => string | null;
}

/** La date à garder pour chaque élément posé qui n'en a pas encore. */
export function planArrivalDates({ known, before, inserted, at, identity }: ArrivalInput): Map<string, number> {
  const out = new Map<string, number>();
  if (known.size === 0) return out;
  const place = Math.max(0, Math.min(at, before.length));
  const neighbour = (): number | undefined => {
    for (let i = place - 1; i >= 0; i -= 1) {
      const date = known.get(before[i]!);
      if (date !== undefined) return date;
    }
    for (let i = place; i < before.length; i += 1) {
      const date = known.get(before[i]!);
      if (date !== undefined) return date;
    }
    return undefined;
  };
  for (const id of inserted) {
    if (known.has(id) || out.has(id)) continue;
    const own = identity(id);
    const twin = own ? before.find((other) => other !== id && known.has(other) && identity(other) === own) : undefined;
    const date = twin !== undefined ? known.get(twin) : neighbour();
    if (date !== undefined) out.set(id, date);
  }
  return out;
}
