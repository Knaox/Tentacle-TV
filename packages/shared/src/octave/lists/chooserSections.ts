/**
 * Octave — « Ajouter à une playlist » : les playlists FAVORITES d'abord, dans l'ordre personnel du compte (lot fl,
 * 30/10), puis les autres dans le leur. Seules celles où l'on peut ajouter (`editable`). Pur.
 */

import type { MusicPlaylist } from "../../music";

export interface ChooserSections {
  favorites: MusicPlaylist[];
  others: MusicPlaylist[];
}

/**
 * @param editable Les playlists où ce compte peut ajouter (dans l'ordre reçu).
 * @param favorites Les playlists favorites de la bibliothèque, dans l'ordre personnel (`usePlaylistShelf().favorites`).
 * @param rest Le reste, dans l'ordre personnel ; une playlist modifiable qu'aucun des deux ne connaît va à la fin.
 */
export function chooserSections(editable: readonly MusicPlaylist[], favorites: readonly MusicPlaylist[], rest: readonly MusicPlaylist[]): ChooserSections {
  const allowed = new Map(editable.map((p) => [p.jellyfinId, p]));
  const taken = new Set<string>();
  const pick = (list: readonly MusicPlaylist[]) =>
    list.flatMap((p) => {
      const own = allowed.get(p.jellyfinId);
      if (!own || taken.has(p.jellyfinId)) return [];
      taken.add(p.jellyfinId);
      return [own];
    });
  const first = pick(favorites);
  const others = [...pick(rest), ...pick(editable)];
  return { favorites: first, others };
}
