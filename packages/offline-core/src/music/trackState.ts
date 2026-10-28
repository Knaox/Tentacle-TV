/**
 * Octave — l'ÉTAT d'un titre tel que toute rangée le montre, règle PURE et UNIQUE
 * (`trackState.test.ts`) : la même marque partout (rangée de liste, d'album, de
 * recherche, « Sur cet appareil »), jamais une variante par page.
 *
 * - `kept` : la copie est sur cet appareil, complète — elle se lit sans réseau ;
 * - `keeping` / `keepFailed` : demandé, en route (file, préparation, transfert) ou en défaut ;
 * - `library` : dans la bibliothèque Jellyfin du serveur, pas sur l'appareil ;
 * - `cloud` : hors bibliothèque, lu à la demande depuis l'extension (Sillon) ;
 * - `unavailable` : connu mais illisible (absent de toute source — l'état de l'axe
 *   « indisponible » le pose par `unavailable: true`).
 *
 * Priorité : ce qui est SUR l'appareil d'abord (une copie complète se lit même
 * d'un titre devenu indisponible), puis l'indisponibilité, puis l'origine.
 * Hors de la portée du hors ligne (session de profil, serveur sans
 * `offline.music`) la plateforme passe `keptStage: "none"` : rien du disque ne se dit.
 */

import type { TrackAvailability } from "@tentacle-tv/shared/music";
import type { KeptStage } from "./keptProgress";

export type TrackState = "kept" | "keeping" | "keepFailed" | "library" | "cloud" | "unavailable";

export interface TrackStateInput {
  availability: TrackAvailability;
  jellyfinId: string | null;
  keptStage: KeptStage;
  /** Le titre n'est lisible nulle part (axe « indisponible ») ; absent : lisible. */
  unavailable?: boolean;
}

export function trackState(input: TrackStateInput): TrackState {
  if (input.keptStage === "complete") return "kept";
  if (input.keptStage === "failed") return "keepFailed";
  if (input.keptStage !== "none") return "keeping";
  if (input.unavailable) return "unavailable";
  if (input.jellyfinId && input.availability === "library") return "library";
  return "cloud";
}
