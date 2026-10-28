/**
 * Octave (mobile) — le REGISTRE où chaque axe branche ses écrans et ses
 * morceaux de coquille. Chaque axe n'édite QUE son fichier (`axes/<axe>.ts`) ;
 * `octaveRegistry.ts` les réunit. Un écran non branché rend la page d'attente.
 */

import type { ComponentType, ReactNode } from "react";

/** Les écrans d'Octave, un par adresse (`octavePaths`, shared). */
export type OctaveScreenName =
  | "home" | "search" | "library" | "liked" | "playlists" | "playlist" | "album" | "artist"
  | "externalPlaylist" | "mood" | "device" | "settings" | "profiles";

/**
 * Ce que reçoit un écran : les paramètres de son adresse, DÉCODÉS — `id` (album,
 * artiste, playlist, ambiance), `key` (playlist d'une extension), et pour la
 * recherche `q` (la question, gardée dans l'adresse : elle se rouvre au lancement).
 */
export interface OctaveScreenProps {
  params: Readonly<Record<string, string | undefined>>;
}

export interface OctaveMiniPlayerProps {
  /** Téléphone (au-dessus de la barre d'onglets) ou tablette (sous le contenu, à droite de la barre latérale). */
  layout: "phone" | "tablet";
}

export interface OctaveAxisContribution {
  screens?: Partial<Record<OctaveScreenName, ComponentType<OctaveScreenProps>>>;
  /** Le mini-lecteur (m2). La coquille le place et mesure sa hauteur : les pages s'écartent d'autant. */
  miniPlayer?: ComponentType<OctaveMiniPlayerProps>;
  /** Montés au-dessus de toute la coquille (lecteur plein écran, feuilles d'actions…). */
  overlays?: ComponentType[];
  /** Enveloppent la coquille d'Octave (contextes propres au mode), dans l'ordre. */
  providers?: ComponentType<{ children: ReactNode }>[];
}
