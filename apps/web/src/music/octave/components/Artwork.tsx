/**
 * Octave — une pochette (ou la photo d'un artiste) : place réservée (aucun
 * saut de mise en page), chargement paresseux, repli dessiné sans image.
 */

import { memo, useState } from "react";
import { Music, User } from "lucide-react";
import { serverUrl } from "../data/libraryApi";

interface ArtworkProps {
  url: string | null;
  /** Texte alternatif ; vide pour une image décorative (le titre est écrit à côté). */
  alt?: string;
  className?: string;
  round?: boolean;
  kind?: "album" | "artist";
  /** Pochette au-dessus de la ligne de flottaison : pas de chargement paresseux. */
  eager?: boolean;
}

export const Artwork = memo(function Artwork({ url, alt = "", className = "", round = false, kind = "album", eager = false }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : serverUrl(url);
  const Icon = kind === "artist" ? User : Music;
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-fill-soft ${round ? "rounded-full" : "rounded-md"} ${className}`}
      aria-hidden={alt === "" ? true : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-content-quaternary">
          <Icon className="h-1/3 w-1/3" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
});
