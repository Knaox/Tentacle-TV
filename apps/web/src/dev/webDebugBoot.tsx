import { installNetworkProbe } from "./networkProbe";
import { installReducedMotionShim } from "./reducedMotionShim";

export { PlayerDebugPanel as WebDebugPanel } from "./PlayerDebugPanel";

/**
 * Le débogage du web, en UN morceau chargé à la demande — derrière
 * `isWebDebugEnabled()` (`lib/webDebug.ts`) : sans débogage, rien de ce
 * module n'est téléchargé ni monté.
 *
 * Posé AVANT le premier rendu (`main.tsx` attend ce module) :
 *  - le journal des requêtes sortantes (section « Réseau » du panneau) ;
 *  - `?reducedmotion=1`, le mode mouvement réduit forcé.
 * Puis monté à la racine : le panneau de diagnostic (`WebDebugPanel`, bouton
 * DEBUG et F9 — la touche N y force l'écran des nouveautés).
 *
 * Arrivé par un import dynamique, le journal s'installe quelques millisecondes
 * après le début du script principal : la toute première requête (la langue
 * du compte) peut lui échapper.
 */
export function bootWebDebug(): void {
  installNetworkProbe();
  installReducedMotionShim();
}
