/**
 * Le Retour de la plateforme — POINT D'ENTRÉE NEUTRE : ce fichier est celui de
 * l'Apple TV (tsc le lit, Metro le prend sur tvOS), `backScope.android.ts` son
 * jumeau aux MÊMES noms.
 * - `PlatformBackScope` : la portée que le navigateur pose autour de chaque
 *   écran (par `redesignWiring/back/BackScope`) ;
 * - `useExitOnBack` : Retour sur une surface hors des écrans qui tient le
 *   focus (le voile hors ligne) — la sortie de l'application.
 */
export { TvosBackScope as PlatformBackScope } from "./tvos/back/BackScope";

/**
 * Rien à faire sur tvOS : Menu sur une surface hors des écrans ne rencontre
 * aucun `MenuPressInterceptor` et remonte à UIKit, qui quitte de lui-même.
 */
export function useExitOnBack(_active: boolean): void {}
