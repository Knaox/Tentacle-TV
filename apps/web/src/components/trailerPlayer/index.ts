/**
 * La PORTE du lecteur complet des bandes-annonces : tout ce qui l'ouvre passe
 * par ici. Le client LG la remplace (`apps/tv-webos/client/src/shims/trailerPlayer.ts`,
 * `substitutionTable.ts`) : son build n'a qu'un faux hls.js, et ce dossier
 * en est exclu — la dalle garde le lecteur officiel (LG en pause).
 */

export { TrailerPlayer, type TrailerPlayerProps } from "./TrailerPlayer";
export { useTrailerIntent, type TrailerIntentHandlers } from "./useTrailerIntent";

/** Le lecteur complet existe-t-il dans ce build ? `false` sur la dalle LG. */
export const TRAILER_PLAYER_AVAILABLE = true;
