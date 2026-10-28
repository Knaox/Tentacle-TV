/**
 * « Qui regarde ? » et un serveur qui ne répond pas — règle de Damien (28/10), commune au mobile, au bureau et
 * au navigateur : on n'y reste JAMAIS bloqué sur « serveur inaccessible ». Trois sorties, toujours dites :
 *
 * - **Réessayer** ;
 * - **Continuer hors ligne** — seulement là où le hors ligne existe (bureau, mobile ; jamais le navigateur) et
 *   si le COMPTE DE L'APPAREIL a quelque chose de gardé ici (`offlineSurfaceOf`, la règle du hors ligne : jamais
 *   un profil, jamais un compte à qui le serveur refuse `keepOffline`). On y revient au compte, comme quand la
 *   connexion tombe pendant un profil (`offlineSessionFallback`) : aucun code PIN ne se vérifie sans serveur, et
 *   le hors ligne n'appartient qu'au compte ;
 * - **Se déconnecter** (puis se connecter ailleurs : un autre serveur, un autre compte).
 *
 * Pur (`pickerUnreachable.test.ts`) : l'adaptateur dit la plateforme, le droit retenu et ce qui est gardé.
 */

import { offlineSurfaceOf, type KeepRight } from "./offlineOwner";

export interface PickerUnreachableInput {
  /** La plateforme a un hors ligne (bureau, mobile). */
  offlineSupported: boolean;
  /** Le droit `keepOffline` du compte de l'appareil, d'après le dernier mot retenu. */
  keepRight: KeepRight;
  /** Le compte de l'appareil a au moins un titre complet ici ; null : pas encore su. */
  hasContent: boolean | null;
}

export interface PickerUnreachableExits {
  retry: true;
  goOffline: boolean;
  signOut: true;
}

export function pickerUnreachableExits(input: PickerUnreachableInput): PickerUnreachableExits {
  const surface = offlineSurfaceOf({ profileSession: false, keepRight: input.keepRight, engineCanKeep: false, hasContent: input.hasContent === true });
  return { retry: true, goOffline: input.offlineSupported && input.hasContent === true && surface.visible, signOut: true };
}
