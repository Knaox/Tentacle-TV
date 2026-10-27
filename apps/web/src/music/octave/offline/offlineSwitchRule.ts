/**
 * Octave — passer hors ligne, ou en revenir, depuis Octave, règle PURE
 * (`offlineSwitchRule.test.ts`). Le MÊME état que le mode films
 * (`setManualOffline`, `offline/connectivityStore`) : passé hors ligne ici,
 * Tentacle l'est aussi, et inversement.
 *
 * - « Passer hors ligne » : en ligne, sur le bureau, pour le compte de
 *   l'appareil (la porte de la musique gardée, `keepRules.ts` →
 *   `offlineSurfaceOf` : jamais une session de profil), et seulement s'il a de
 *   la musique gardée EN ENTIER — sans elle, Octave hors ligne n'a rien à
 *   montrer et renvoie à l'accueil des films (`OfflineOctave.tsx`).
 * - « Revenir en ligne » : hors ligne PAR CHOIX, toujours, sur le bureau — la
 *   sortie ne dépend de rien d'autre (une porte refermée entre-temps ne doit
 *   jamais y laisser enfermé).
 * - « Réessayer » : hors ligne SUBI (serveur injoignable) ; revenir n'est pas
 *   en notre pouvoir, la sonde le fera d'elle-même — on peut la relancer.
 * - Pendant la première sonde (`checking`) : rien.
 */

import type { ConnectivityState } from "@tentacle-tv/offline-core";

export type OfflineSwitchKind = "goOffline" | "goOnline" | "retry";

export interface OfflineSwitchInputs {
  /** Le hors ligne applicatif existe ici (la coquille du bureau). */
  desktop: boolean;
  state: ConnectivityState;
  profileSession: boolean;
  /** La porte de la musique gardée (`MusicOfflineSurface.visible`). */
  surfaceVisible: boolean;
  /** Le compte de l'appareil a au moins un titre gardé en entier. */
  hasPlayable: boolean;
}

export function offlineSwitchOf(input: OfflineSwitchInputs): OfflineSwitchKind | null {
  if (!input.desktop) return null;
  if (input.state === "offline-manual") return "goOnline";
  if (input.profileSession) return null;
  if (input.state === "offline-auto") return "retry";
  if (input.state === "online" && input.surfaceVisible && input.hasPlayable) return "goOffline";
  return null;
}
