/**
 * Octave — le menu d'un album, d'un artiste ou d'une playlist (clic droit, appui long, « … ») : les actions du
 * modèle partagé (`collectionActions`) pour CE compte et CE serveur, et les gestes que le cœur sait faire seul
 * (favori, « Mettre en haut »). Le reste (modifier, partager, supprimer, quitter, réordonner) est rendu par la vue :
 * `run` les lui rend (`false`).
 */

import { useCallback, useMemo } from "react";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { collectionActions, type CollectionAction, type CollectionActionId, type CollectionKind } from "@tentacle-tv/shared/octave";
import type { LibraryShelf } from "./useLibraryShelf";
import { shelfFavoriteOf, shelfSubjectKey, useMusicShelves, useToggleShelfFavorite, type MusicShelfSubject } from "./useMusicShelves";
import { useMusicPlaylistMembersAvailable, usePlaylistSharingRules } from "./useMusicPlaylistMembers";
import { useMusicPlaylistShareAvailable } from "./useMusicPlaylistShare";

const KIND: Record<MusicShelfSubject["section"], CollectionKind> = { albums: "album", artists: "artist", playlists: "playlist" };

export interface CollectionMenu {
  /** La clé de l'élément dans sa rubrique (`shelfKeyOf`). */
  key: string;
  actions: CollectionAction[];
  favorite: boolean | undefined;
  /** Fait le geste s'il est du cœur (favori, « Mettre en haut ») et rend `true` ; `false` : à la vue de le faire. */
  run: (id: CollectionActionId) => boolean;
}

/** `shelf` : la rubrique où l'élément est montré (bibliothèque) ; absente ailleurs (accueil, recherche) — pas d'ordre. */
export function useCollectionMenu(subject: MusicShelfSubject, shelf?: Pick<LibraryShelf<unknown>, "ordered" | "atTop" | "canReorder" | "moveToTop">): CollectionMenu {
  const { capable, shelves } = useMusicShelves();
  const toggle = useToggleShelfFavorite();
  const playlist: MusicPlaylist | null = subject.section === "playlists" && subject.item.kind === "library" ? subject.item.playlist : null;
  const rules = usePlaylistSharingRules(playlist);
  const members = useMusicPlaylistMembersAvailable();
  const shareLink = useMusicPlaylistShareAvailable();
  const key = shelfSubjectKey(subject);
  const favorite = shelfFavoriteOf(subject, shelves, capable);
  const ordered = shelf?.ordered(key) ?? false;
  const actions = useMemo(
    () =>
      collectionActions({
        kind: KIND[subject.section],
        favorite,
        canFavorite: capable,
        ordered,
        atTop: shelf?.atTop(key) ?? true,
        canReorder: shelf?.canReorder(key) ?? false,
        ...(subject.section === "playlists" && {
          playlist: { editable: playlist?.editable === true, isMember: rules.isMember, canShareWith: members, canShareLink: shareLink },
        }),
      }),
    [subject.section, favorite, capable, ordered, shelf, key, playlist, rules.isMember, members, shareLink],
  );
  const run = useCallback(
    (id: CollectionActionId) => {
      if (id === "favorite" || id === "unfavorite") {
        toggle.mutate({ subject, favorite: id === "favorite" });
        return true;
      }
      if (id === "moveTop" && shelf) {
        shelf.moveToTop(key);
        return true;
      }
      return false;
    },
    [toggle, subject, shelf, key],
  );
  return { key, actions, favorite, run };
}
