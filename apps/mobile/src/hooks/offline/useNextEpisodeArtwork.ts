import { useMemo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { localExists, metaUri } from "@/offline/engineApi";
import { useLocalSnapshotJson } from "./useLocalSnapshot";

/** Les visuels et le synopsis du titre SUIVANT, lus dans son snapshot local. */
export interface NextEpisodeArtwork {
  thumbUri: string | null;
  backdropUri: string | null;
  description: string | null;
}

/**
 * La carte « à suivre » et l'affiche de fin d'une lecture locale ne demandent
 * rien au serveur : la vignette (`primary.jpg`), la bannière (`backdrop.jpg`,
 * celle de la série dans le snapshot) et le synopsis (`item.json`) du suivant
 * viennent de son propre dossier de snapshot.
 */
export function useNextEpisodeArtwork(nextItemId: string | undefined): NextEpisodeArtwork | null {
  const { data: snapshot } = useLocalSnapshotJson<MediaItem>(nextItemId, "item.json");
  return useMemo(() => {
    if (nextItemId === undefined) return null;
    const thumb = metaUri(nextItemId, "primary.jpg");
    const backdrop = metaUri(nextItemId, "backdrop.jpg");
    return {
      thumbUri: localExists(thumb) ? thumb : null,
      backdropUri: localExists(backdrop) ? backdrop : null,
      description: snapshot?.Overview ?? null,
    };
  }, [nextItemId, snapshot]);
}
