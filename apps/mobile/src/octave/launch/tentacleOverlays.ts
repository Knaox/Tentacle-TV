/**
 * Octave (mobile) — les RECOUVREMENTS DE DÉMARRAGE de Tentacle face au mode
 * musique, règle PURE (testée sans React Native). En mode Octave, et pendant
 * un démarrage instantané en Octave, aucun ne se présente : ni l'affiche de la
 * Famille, ni le premier lancement d'un profil, ni l'invitation aux avatars, ni
 * le conseil du code PIN, ni les avertissements de Tentacle (serveur, TMDB…).
 * Ils ATTENDENT le retour dans Tentacle (leurs hôtes ne sont pas montés : le
 * registre `startup/` les voit tus), puis se présentent comme d'habitude.
 *
 * Restent, parce qu'ils ne sont pas « de Tentacle » mais de l'appareil ou du
 * serveur : « Qui regarde ? » (la sécurité, réglée pour Octave par son option
 * PIN), les messages de l'administrateur, la migration de la base, l'accès
 * suspendu, le passage hors ligne et les demandes de permission du système.
 */

import type { StartupOverlayKey } from "@/startup/startupOverlays";

/** Ceux qu'Octave retient jusqu'au retour dans Tentacle. */
export const TENTACLE_OVERLAYS_HELD_IN_OCTAVE: readonly StartupOverlayKey[] = ["notices", "family", "firstRun", "avatars", "familyPin"];

export interface TentacleHoldInput {
  /** Le mode musique est allumé (`octaveModeStore`). */
  octaveMode: boolean;
  /** Le lancement s'est fait dans Octave… */
  launchedInOctave: boolean;
  /** …et l'on n'en est pas encore sorti. */
  released: boolean;
}

/** Tentacle est-il retenu ? En mode Octave, toujours ; au lancement en Octave, jusqu'à la première sortie. */
export function tentacleHeldNow({ octaveMode, launchedInOctave, released }: TentacleHoldInput): boolean {
  return octaveMode || (launchedInOctave && !released);
}

/** Ce recouvrement peut-il se présenter maintenant ? */
export function startupOverlayAllowed(key: StartupOverlayKey, tentacleHeld: boolean): boolean {
  return !tentacleHeld || !TENTACLE_OVERLAYS_HELD_IN_OCTAVE.includes(key);
}
