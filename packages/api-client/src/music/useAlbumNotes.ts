/**
 * Octave — les notes d'un album (sa description Jellyfin : mentions, source, licence), prêtes à dessiner. LA porte
 * de la page album sur le bureau, le web étroit et le mobile : la règle est dans le partagé (`albumNotesOf`), chaque
 * vue ne fait que rendre les lignes, liens compris. Rien tant que l'album n'a pas répondu ; un serveur qui ne sert
 * pas la description (d'avant 1.40.0) : aucune ligne, aucune erreur.
 */

import { useMemo } from "react";
import { albumNotesOf, type AlbumNoteLine, type MusicAlbum } from "@tentacle-tv/shared/music";

export function useAlbumNotes(album: Pick<MusicAlbum, "description"> | null | undefined): AlbumNoteLine[] {
  const description = album?.description ?? null;
  return useMemo(() => albumNotesOf({ description }), [description]);
}
