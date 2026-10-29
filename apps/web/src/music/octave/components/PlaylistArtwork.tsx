/**
 * Octave — la jaquette d'une playlist : la mosaïque du jour que le cœur compose (`MusicPlaylist.mosaic`,
 * `musicMosaic.ts`), ou l'image de Jellyfin quand il n'en compose pas (image posée à la main, serveur d'avant).
 * Hors ligne, « Sur cet appareil » passe les pochettes GARDÉES choisies par la même règle (`keptPlaylistArt.ts`).
 *
 * Quatre images : une grille 2 × 2 bord à bord, que le cadre arrondit (jamais un séparateur, jamais une case
 * arrondie à part) ; moins : une seule pochette. Place carrée réservée par l'appelant, aucune animation : une
 * pochette neuve arrive par le fondu d'`Artwork`, une pochette connue s'affiche d'emblée. Image décorative : le
 * nom de la playlist est écrit à côté.
 */

import { memo } from "react";
import { playlistCoverLayout } from "@tentacle-tv/shared/music";
import { ARTWORK_RADIUS, Artwork, type ArtworkRadius } from "./Artwork";

/** La taille de la pochette d'en-tête (`CollectionHeader`). */
export const HEADER_ARTWORK_CLASS = "h-44 w-44 shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56";

/** La règle est partagée avec le mobile (`playlistCover.ts`) : la même jaquette partout. */
export { playlistCoverUrls } from "@tentacle-tv/shared/music";

interface PlaylistArtworkProps {
  /** `null` : une case dont l'image n'est pas là (hors ligne) — la teinte du repli, jamais une case vide. */
  urls: readonly (string | null)[];
  /** Le nom de la playlist : la teinte du repli sans image. */
  label: string;
  className?: string;
  radius?: ArtworkRadius;
  /** Vignette de liste (barre latérale) : chaque case demande 128 px au cœur. */
  thumb?: boolean;
  eager?: boolean;
}

export const PlaylistArtwork = memo(function PlaylistArtwork({ urls, label, className = "", radius = "art", thumb = false, eager = false }: PlaylistArtworkProps) {
  const layout = playlistCoverLayout(urls);
  if (layout.kind === "single") return <Artwork url={layout.url} label={label} radius={radius} className={className} thumb={thumb} eager={eager} />;
  return (
    // Des carreaux en flex, pas une grille à rangées : le client des téléviseurs LG (Chrome 53) compile ce fichier.
    <div aria-hidden className={`relative flex shrink-0 flex-wrap overflow-hidden bg-fill-soft ${className}`} style={{ borderRadius: ARTWORK_RADIUS[radius] }}>
      {layout.cells.map((url, cell) => (
        <Artwork key={`${cell}:${url ?? ""}`} url={url} label={label} radius="none" thumb={thumb} eager={eager} className="h-1/2 w-1/2" />
      ))}
    </div>
  );
});
