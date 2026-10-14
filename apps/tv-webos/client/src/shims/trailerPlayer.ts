/**
 * Le lecteur complet des bandes-annonces, absent de la dalle LG.
 *
 * Il lit le relais du serveur par hls.js, que le client LG remplace par un
 * faux ; et LG est en pause. Ce module remplace sa SEULE porte
 * (`components/trailerPlayer/index.ts`) : son dossier ne se compile pas
 * (`EXCLUDED_WEB_DIRECTORIES`), et le bouton « Bande-annonce » garde la
 * modale du lecteur officiel (`TRAILER_PLAYER_AVAILABLE` faux).
 */
export type { TrailerPlayerProps } from "@/components/trailerPlayer/TrailerPlayer";
export type { TrailerIntentHandlers } from "@/components/trailerPlayer/useTrailerIntent";
import type { TrailerIntentHandlers } from "@/components/trailerPlayer/useTrailerIntent";

export const TRAILER_PLAYER_AVAILABLE = false;

export function TrailerPlayer(): null {
  return null;
}

function nothing(): void {
  /* Rien à préparer : la dalle n'ouvre que le lecteur officiel. */
}

const INERT: TrailerIntentHandlers = { onPointerEnter: nothing, onPointerLeave: nothing, onFocus: nothing, onBlur: nothing };

export function useTrailerIntent(): TrailerIntentHandlers {
  return INERT;
}
