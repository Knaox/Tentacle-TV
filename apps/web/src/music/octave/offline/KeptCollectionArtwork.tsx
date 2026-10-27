/**
 * Octave — la jaquette d'une collection gardée (« Sur cet appareil ») : celle de la playlist en ligne, avec les
 * pochettes gardées (`keptPlaylistArt.ts`). Un album gardé garde sa pochette. Aucune requête : tout vient de la base
 * des transferts.
 */

import { memo, useMemo } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { ArtworkRadius } from "../components/Artwork";
import { PlaylistArtwork } from "../components/PlaylistArtwork";
import type { DeviceCollection } from "./deviceModel";
import { keptCollectionCover } from "./keptPlaylistArt";

interface KeptCollectionArtworkProps {
  collection: DeviceCollection;
  kept: readonly KeptMusicTrack[];
  offline: boolean;
  className?: string;
  radius?: ArtworkRadius;
  eager?: boolean;
}

export const KeptCollectionArtwork = memo(function KeptCollectionArtwork({ collection, kept, offline, className, radius = "art", eager }: KeptCollectionArtworkProps) {
  // Le jour se relit avec la collection : la jaquette ne change pas sous les yeux, elle suit la page suivante.
  const urls = useMemo(() => keptCollectionCover(collection, kept, { now: Date.now(), remote: !offline }), [collection, kept, offline]);
  return <PlaylistArtwork urls={urls} label={collection.title} radius={radius} eager={eager} className={className} />;
});
