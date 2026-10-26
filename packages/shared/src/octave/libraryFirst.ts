/**
 * Octave — JELLYFIN FAIT FOI (Damien, 26/10 : « dans mes playlists, un titre qui est DÉJÀ dans ma bibliothèque
 * apparaît comme en file d'attente »). Règle pure.
 *
 * Une rangée « en attente » (une demande de l'extension : en file, Lidarr le cherche, échouée…) dont le titre est
 * DANS LA BIBLIOTHÈQUE (correspondance de l'index local du cœur, `useMusicLibraryMatch`) se montre comme le titre
 * de la bibliothèque : sa marque, sa lecture, aucune note ni retenue, quel que soit l'état de la demande. Elle
 * garde sa clé de rangée et son opération (la retirer annule encore la demande) ; si le titre est déjà une rangée
 * réelle de la même liste, elle s'efface — jamais deux fois le même titre.
 */

import type { MusicTrack } from "../music";
import type { ListRow } from "./pendingMerge";

/**
 * @param owned La correspondance : clé d'un titre d'ailleurs → le titre de la bibliothèque qui l'est.
 * @returns Les mêmes rangées (même référence si rien ne change).
 */
export function libraryFirst(rows: readonly ListRow[], owned: ReadonlyMap<string, MusicTrack>): readonly ListRow[] {
  if (owned.size === 0 || !rows.some((r) => r.pending)) return rows;
  const real = new Set(rows.filter((r) => !r.pending).map((r) => r.track.key));
  let changed = false;
  const out: ListRow[] = [];
  for (const row of rows) {
    const own = row.pending && row.track.jellyfinId === null ? owned.get(row.track.key) : undefined;
    if (!row.pending || !own) {
      out.push(row);
      continue;
    }
    changed = true;
    if (real.has(own.key)) continue;
    real.add(own.key);
    out.push({ ...row, track: own, pending: { ...row.pending, failed: false, note: null } });
  }
  return changed ? out : rows;
}
