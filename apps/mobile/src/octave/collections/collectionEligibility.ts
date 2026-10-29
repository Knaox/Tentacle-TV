/**
 * Octave mobile — un élément a-t-il une feuille d'actions ? Un album ou un artiste hors bibliothèque n'a pas
 * de favori (Jellyfin ne le connaît pas, le serveur n'en garde pas) ; sans la capacité
 * `music.libraryFavorites`, seule une playlist qu'on gère (ou qu'on a reçue) a encore des actions. La règle
 * des actions elle-même est partagée (`collectionActions`) : ceci ne décide que d'ouvrir la feuille.
 */

import type { MusicShelfSubject } from "@tentacle-tv/api-client";

export function hasCollectionActions(subject: MusicShelfSubject, capable: boolean): boolean {
  if (subject.section !== "playlists") return capable && !!subject.item.jellyfinId;
  if (capable) return true;
  const p = subject.item.kind === "library" ? subject.item.playlist : null;
  return !!p && (p.editable || p.sharing?.role === "member");
}

