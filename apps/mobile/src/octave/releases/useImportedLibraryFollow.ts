/**
 * Octave mobile — une sortie importée et la bibliothèque Jellyfin (`importedLibraryState`) : EN ROUTE, la page la
 * relit toutes les 20 s tant qu'elle est ouverte et l'app au premier plan ; ENTRÉE (tous ses titres dans Jellyfin),
 * la page cède la place à l'album de la bibliothèque (navigation remplacée : ni saut ni entrée d'historique). Dossier non réglé : rien.
 */

import { useEffect } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { importedLibraryState, RELEASE_LIBRARY_POLL_MS, useImportedLibraryAlbum } from "@tentacle-tv/api-client";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicAlbum } from "@tentacle-tv/shared/music";

export function useImportedLibraryFollow(album: MusicAlbum | null | undefined, refetch: () => unknown): void {
  const router = useRouter();
  const state = importedLibraryState(album);
  // L'album garde `jellyfinId` nul : celui de la bibliothèque se tire de ses titres (contrat de f3).
  const target = useImportedLibraryAlbum(album);
  const onTheWay = state.kind === "onTheWay";
  useEffect(() => {
    if (target) router.replace(octavePaths.album(target) as never);
  }, [router, target]);
  useEffect(() => {
    if (!onTheWay) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refetch();
    }, RELEASE_LIBRARY_POLL_MS);
    return () => clearInterval(timer);
  }, [onTheWay, refetch]);
}
