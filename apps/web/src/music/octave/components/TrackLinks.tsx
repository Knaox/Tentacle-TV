/**
 * Octave — les noms d'un titre qui MÈNENT quelque part : ses artistes et son
 * album, liens vers leur page (bibliothèque ou ailleurs : `trackTargets.ts`), ou
 * simple texte quand il n'y a rien où aller. Un clic suit le lien sans lire la
 * rangée (`stopPropagation`) ; souligné au survol, comme le texte autour. Un
 * album d'ailleurs s'ouvre AUSSITÔT sur ce que la rangée montrait (son nom, sa
 * pochette : `albumPreviewOfTrack`), ses titres à la réponse.
 */

import { memo, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { albumPathOf, artistPathOf } from "./trackTargets";
import { entityTarget } from "../octavePaths";
import { albumPreviewOfTrack, rememberAlbumPreview } from "../data/albumPreview";

const linkClass = "hover:text-content-primary hover:underline focus-visible:underline focus-visible:outline-none";
const stop = (e: MouseEvent) => e.stopPropagation();

interface LinkProps {
  track: Pick<MusicTrack, "artists" | "album"> & Partial<Pick<MusicTrack, "artworkUrl" | "year">>;
  className?: string;
  /** Un clic qui mène ailleurs referme aussi ce qui l'entoure (la feuille « en cours »). */
  onNavigate?: () => void;
}

export const ArtistLinks = memo(function ArtistLinks({ track, className = linkClass, onNavigate }: LinkProps) {
  return (
    <>
      {track.artists.map((artist, i) => {
        const path = artistPathOf(artist);
        return (
          <span key={`${artist.name}-${i}`}>
            {i > 0 && ", "}
            {path ? (
              <Link to={path} onClick={(e) => { stop(e); onNavigate?.(); }} className={className}>
                {artist.name}
              </Link>
            ) : (
              artist.name
            )}
          </span>
        );
      })}
    </>
  );
});

export const AlbumLink = memo(function AlbumLink({ track, className = linkClass, onNavigate }: LinkProps) {
  if (!track.album) return null;
  const path = albumPathOf(track);
  if (!path) return <>{track.album.title}</>;
  const remember = () => {
    const key = track.album ? entityTarget({ jellyfinId: track.album.jellyfinId, external: track.album.external ?? null }) : null;
    const preview = key ? albumPreviewOfTrack(key, track) : null;
    if (key && preview) rememberAlbumPreview(key, preview);
  };
  return (
    <Link to={path} onClick={(e) => { stop(e); remember(); onNavigate?.(); }} className={className} data-octave-album-link>
      {track.album.title}
    </Link>
  );
});
