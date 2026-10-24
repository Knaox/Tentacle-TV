/**
 * Octave — une pochette (ou la photo d'un artiste) : place réservée (aucun
 * saut de mise en page), chargement paresseux, repli dessiné sans image.
 *
 * L'adresse suit la règle du moteur (`elementSourceUrl`, A2) : telle quelle
 * avec une session par cookie (le web), le jeton en `api_key` sinon (le
 * bureau) — une `<img>` ne pose pas d'en-tête, et le cœur l'accepte sur
 * `/api/music/artwork` (A3). Une URL https tierce reste telle quelle — et
 * SANS le jeton : il ne quitte jamais le serveur Tentacle.
 *
 * Une image déjà décodée (`artworkPreload.ts` : préparée avant la révélation
 * des résultats) s'affiche d'emblée ; une autre arrive en fondu d'opacité,
 * sur sa place réservée — jamais un « pop » sous les yeux.
 */

import { memo, useMemo, useState } from "react";
import { isArtworkDecoded, markArtworkDecoded } from "./artworkPreload";
import { Music, User } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../../lib/backendBase";
import { elementSourceUrl } from "../../engine";

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

/** L'adresse affichable d'une image du cœur. */
export function useArtworkSrc(url: string | null): string | null {
  const client = useJellyfinClient();
  const baseUrl = getBackendBase();
  const token = client.getToken();
  const useCredentials = client.useCredentials;
  return useMemo(() => {
    if (!url) return null;
    // Une adresse d'un autre hôte : jamais de jeton dans sa requête.
    if (/^https?:\/\//i.test(url)) return url;
    return elementSourceUrl(url, { baseUrl, token, useCredentials });
  }, [url, baseUrl, token, useCredentials]);
}

export const Artwork = memo(function Artwork({ url, alt = "", className = "", round = false, kind = "album", eager = false }: ArtworkProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const resolved = useArtworkSrc(url);
  const src = resolved !== null && failed !== resolved ? resolved : null;
  const ready = src !== null && (loaded === src || isArtworkDecoded(src));
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
          onLoad={() => {
            markArtworkDecoded(src);
            setLoaded(src);
          }}
          onError={() => setFailed(src)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-content-quaternary">
          <Icon className="h-1/3 w-1/3" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
});
