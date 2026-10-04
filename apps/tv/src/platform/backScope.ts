/**
 * Le Retour de la plateforme, résolu par Metro : ce fichier pour Android TV,
 * `backScope.ios.ts` pour l'Apple TV.
 * - `PlatformBackScope` : la portée que le navigateur pose autour de chaque
 *   écran (par `redesignWiring/back/BackScope`) ;
 * - `useExitOnBack` : Retour sur une surface hors des écrans qui tient le
 *   focus (le voile hors ligne) — la sortie de l'application.
 */
export { AndroidBackScope as PlatformBackScope } from "./androidtv/back/AndroidBackScope";
export { useExitOnBack } from "./androidtv/back/useExitOnBack";
