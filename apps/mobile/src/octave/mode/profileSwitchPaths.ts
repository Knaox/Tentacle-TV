/**
 * Octave (mobile) — où mène un changement de profil, selon le MODE en cours : dans Octave, on y reste
 * (l'accueil d'Octave, au nom du nouveau profil — sa porte rend Tentacle si ce profil n'a pas la musique) ;
 * ailleurs, l'accueil de Tentacle, comme avant. « Gérer les profils » : la page Famille DANS Octave, ou celle
 * de Tentacle. Règle pure (`profileSwitchPaths.test.ts`) ; l'appelant passe `isOctaveMode()`.
 */

import { octavePaths } from "@tentacle-tv/shared/octave/mode";

export const TENTACLE_HOME_PATH = "/(tabs)";
export const TENTACLE_FAMILY_PATH = "/family";

export function homeAfterProfileSwitch(inOctave: boolean): string {
  return inOctave ? octavePaths.home : TENTACLE_HOME_PATH;
}

export function manageProfilesPath(inOctave: boolean): string {
  return inOctave ? octavePaths.profiles : TENTACLE_FAMILY_PATH;
}
