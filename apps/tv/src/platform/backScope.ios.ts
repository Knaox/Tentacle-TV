/** Apple TV — voir `backScope.ts`. */
export { TvosBackScope as PlatformBackScope } from "./tvos/back/BackScope";

/**
 * Rien à faire sur tvOS : Menu sur une surface hors des écrans ne rencontre
 * aucun `MenuPressInterceptor` et remonte à UIKit, qui quitte de lui-même.
 */
export function useExitOnBack(_active: boolean): void {}
