/**
 * Octave — la jaquette d'une collection gardée (« Sur cet appareil ») : EXACTEMENT celle de la playlist en ligne
 * (Damien, 28/10) — son image posée à la main, ou la mosaïque du jour, mêmes albums — d'après ce que l'appareil a
 * gardé (`keptCovers/`), avec les pochettes gardées des titres ou les copies gardées. Sans couverture gardée (un
 * serveur d'avant, une playlist gardée jamais revue depuis), la règle calculée sur les titres gardés
 * (`keptPlaylistArt.ts`). Un album gardé garde sa pochette. Aucune requête.
 */

import { memo, useMemo } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { localResourceUrl, useDownloadsRootReady } from "../../../downloads/localFiles";
import type { ArtworkRadius } from "../components/Artwork";
import { PlaylistArtwork } from "../components/PlaylistArtwork";
import { type DeviceCollection, keptCollectionCover, keptPlaylistId, keptCoverUrls, localCoversByUrl, shownCoverUrls } from "@tentacle-tv/offline-core/music";
import { useKeptCoverState } from "./keptCovers/useKeptCoverKeeper";

interface KeptCollectionArtworkProps {
  collection: DeviceCollection;
  kept: readonly KeptMusicTrack[];
  offline: boolean;
  className?: string;
  radius?: ArtworkRadius;
  eager?: boolean;
}

export const KeptCollectionArtwork = memo(function KeptCollectionArtwork({ collection, kept, offline, className, radius = "art", eager }: KeptCollectionArtworkProps) {
  const { covers, copies } = useKeptCoverState();
  const rootReady = useDownloadsRootReady();
  const playlistId = keptPlaylistId(collection);
  const saved = playlistId ? covers.get(playlistId) : undefined;
  // Le jour se relit avec la collection : la jaquette ne change pas sous les yeux, elle suit la page suivante.
  const urls = useMemo(() => {
    const now = Date.now();
    if (!saved) return keptCollectionCover(collection, kept, { now, remote: !offline });
    const local = localCoversByUrl(kept, rootReady ? localResourceUrl : () => null);
    return shownCoverUrls(keptCoverUrls(saved, now), local, copies, !offline);
  }, [collection, kept, offline, saved, copies, rootReady]);
  return <PlaylistArtwork urls={urls} label={collection.title} radius={radius} eager={eager} className={className} />;
});
