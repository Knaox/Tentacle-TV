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
 *
 * Sans image (ou image illisible) : le repli teinté du titre (`artworkTone.ts`),
 * l'initiale pour un artiste. Une vignette de liste (`thumb`) demande 128 px —
 * sauf si l'image pleine taille est DÉJÀ décodée (préparée par la recherche) :
 * elle sert alors telle quelle, sans attendre.
 */

import { memo, useCallback, useMemo, useState } from "react";
import { isArtworkDecoded, isArtworkFailed, markArtworkDecoded } from "./artworkPreload";
import { THUMB_ARTWORK_SIZE, fallbackTone, initialOf, sizedArtworkUrl } from "./artworkTone";
import "./octaveViews.css";
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
  /** Le nom de ce que l'image montre : la teinte du repli, l'initiale d'un artiste. Par défaut `alt`. */
  label?: string;
  /** Vignette de liste (≤ 64 px) : 128 px demandés au cœur. */
  thumb?: boolean;
  /** Le rayon, par jeton d'Octave : `xs` ≤ 32 px, `sm` rangée (défaut), `art` carte, `lg` tête de vue. */
  radius?: ArtworkRadius;
}

export type ArtworkRadius = "xs" | "sm" | "art" | "lg";

/** Le rayon d'une pochette (`--oc-radius-art-*`, octaveTokens.css) ; un repli si les jetons manquent. */
export const ARTWORK_RADIUS: Record<ArtworkRadius, string> = {
  xs: "var(--oc-radius-art-xs, 4px)",
  sm: "var(--oc-radius-art-sm, 6px)",
  art: "var(--oc-radius-art, 10px)",
  lg: "var(--oc-radius-art-lg, 14px)",
};

/** La règle d'adresse d'une image : jamais de jeton hors du serveur Tentacle. */
function artworkSrcOf(url: string | null, auth: { baseUrl: string; token: string | null; useCredentials: boolean }): string | null {
  if (!url) return null;
  // Une adresse d'un autre hôte : jamais de jeton dans sa requête.
  if (/^https?:\/\//i.test(url)) return url;
  // Une image GARDÉE sur l'appareil (origine locale de la coquille, `tentacle://local/…`) : telle quelle, sans jeton.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return elementSourceUrl(url, auth);
}

/** De quoi calculer l'adresse affichable de n'importe quelle image (préchargement des résultats). */
export function useArtworkResolver(): (url: string | null) => string | null {
  const client = useJellyfinClient();
  const baseUrl = getBackendBase();
  const token = client.getToken();
  const useCredentials = client.useCredentials;
  return useCallback((url: string | null) => artworkSrcOf(url, { baseUrl, token, useCredentials }), [baseUrl, token, useCredentials]);
}

/** Ce qu'affiche une case sans image : la teinte du titre, et l'initiale d'un artiste. */
function ArtworkFallback({ kind, label }: { kind: "album" | "artist"; label: string }) {
  const initial = kind === "artist" ? initialOf(label) : "";
  const Icon = kind === "artist" ? User : Music;
  return (
    <div className="octave-art-fallback octave-art-box absolute inset-0 flex items-center justify-center" data-tone={fallbackTone(label)}>
      {initial ? <span className="octave-art-initial select-none">{initial}</span> : <Icon className="h-[38%] w-[38%]" strokeWidth={1.5} />}
    </div>
  );
}

export const Artwork = memo(function Artwork({ url, alt = "", className = "", round = false, kind = "album", eager = false, label, thumb = false, radius = "sm" }: ArtworkProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const resolve = useArtworkResolver();
  const resolved = useMemo(() => {
    const full = resolve(url);
    if (!thumb || url === null || full === null || isArtworkDecoded(full)) return full;
    return resolve(sizedArtworkUrl(url, THUMB_ARTWORK_SIZE));
  }, [resolve, thumb, url]);
  // Une image dont le préchargement a déjà échoué : le repli d'emblée, jamais une case vide un instant.
  const src = resolved !== null && failed !== resolved && !isArtworkFailed(resolved) ? resolved : null;
  const ready = src !== null && (loaded === src || isArtworkDecoded(src));
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-fill-soft ${className}`}
      style={{ borderRadius: round ? "9999px" : ARTWORK_RADIUS[radius] }}
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
        <ArtworkFallback kind={kind} label={label ?? alt} />
      )}
    </div>
  );
});
