/**
 * Octave (mobile) — le REGISTRE où chaque axe branche ses écrans et ses
 * morceaux de coquille. Chaque axe n'édite QUE son fichier (`axes/<axe>.ts`) ;
 * `octaveRegistry.ts` les réunit. Un écran non branché rend la page d'attente.
 */

import type { ComponentType, ReactNode } from "react";
import type { ServerCapability } from "@tentacle-tv/shared";

/** Les écrans d'Octave, un par adresse (`octavePaths`, shared). */
export type OctaveScreenName =
  | "home" | "search" | "library" | "liked" | "playlists" | "playlist" | "album" | "artist"
  | "externalPlaylist" | "mood" | "device" | "settings" | "profiles" | "account";

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

/**
 * Le DROIT d'une entrée du registre (règle 15 du brief) : une entrée dont le
 * droit manque n'est PAS affichée — ni écran (son adresse renvoie à l'accueil
 * d'Octave), ni raccourci, ni requête. Tout est déjà soumis à Octave lui-même
 * (`music.library` + accès du compte, la porte de la coquille).
 */
export interface OctaveRequirement {
  /** Capacités du serveur exigées, TOUTES (`serverCapabilities.ts`) — jamais une comparaison de version. */
  capabilities?: readonly ServerCapability[];
  /**
   * Un droit lu aux MÊMES sources que le bureau (droits de l'extension, droit hors
   * ligne du compte de l'appareil, invité de la Famille…) : un CROCHET, appelé à
   * chaque rendu. `true` seul affiche ; `false` masque ; `null` : pas encore connu
   * (rien d'affiché, rien qui clignote).
   */
  useAllowed?: () => boolean | null;
}

/** Une entrée du registre : le composant seul (aucun droit propre), ou avec son droit. */
export type OctaveGated<T> = T | { component: T; requires?: OctaveRequirement };

export interface OctaveAxisContribution {
  screens?: Partial<Record<OctaveScreenName, OctaveGated<ComponentType<OctaveScreenProps>>>>;
  /** Le mini-lecteur (m2). La coquille le place et mesure sa hauteur : les pages s'écartent d'autant. */
  miniPlayer?: OctaveGated<ComponentType<OctaveMiniPlayerProps>>;
  /** Montés au-dessus de toute la coquille (lecteur plein écran, feuilles d'actions…). */
  overlays?: OctaveGated<ComponentType>[];
  /** Enveloppent la coquille d'Octave (contextes propres au mode), dans l'ordre. */
  providers?: ComponentType<{ children: ReactNode }>[];
}
