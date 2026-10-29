/**
 * Octave mobile — l'APPUI MAINTENU d'une carte (album, artiste, playlist) : il ouvre la feuille d'actions de
 * l'élément, avec un retour haptique. Rien à ouvrir, rien d'offert (le geste garde alors son sens d'avant) :
 * un album ou un artiste hors bibliothèque n'a pas de favori (Jellyfin ne le connaît pas) ; sans la capacité
 * `music.libraryFavorites`, seule une playlist qu'on gère a encore des actions.
 */

import { useCallback } from "react";
import { useMusicShelvesCapability, type MusicShelfSubject } from "@tentacle-tv/api-client";
import { haptic } from "@/utils/haptics";
import { hasCollectionActions } from "./collectionEligibility";
import { openCollectionSheet, type CollectionSheetShelf } from "./collectionSheetStore";

export function useCollectionLongPress(subject: MusicShelfSubject | null, shelf?: CollectionSheetShelf, onReorder?: () => void): (() => void) | undefined {
  const capable = useMusicShelvesCapability();
  const open = useCallback(() => {
    if (!subject) return;
    haptic("longPress");
    openCollectionSheet({ subject, shelf, onReorder });
  }, [subject, shelf, onReorder]);
  return subject && hasCollectionActions(subject, capable) ? open : undefined;
}
