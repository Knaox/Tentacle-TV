/**
 * Octave mobile — « Réordonner » demandé AILLEURS que sur la page Playlists (la rangée « Vos playlists favorites »
 * de l'accueil, lot fl) : la page s'ouvre directement sur le tri de la section demandée. Une demande, lue une fois.
 */

import type { LibrarySectionId } from "../../pages/library/libraryRows";

let wanted: LibrarySectionId | null = null;

export function requestPlaylistsReorder(section: LibrarySectionId): void {
  wanted = section;
}

/** La section à trier à l'ouverture de la page (une seule fois). */
export function takePlaylistsReorder(): LibrarySectionId | null {
  const section = wanted;
  wanted = null;
  return section;
}
