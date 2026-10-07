import type { RenderTier } from "./renderTier";

/**
 * Les images du mode Lite (Android TV faible) : ce que l'on demande au serveur
 * pour un FOND plein écran — sous les voiles de la fiche, de l'écran de
 * chargement du lecteur, du rappel de l'épisode suivant. Une image de fond est
 * vue étirée et assombrie : 960 × 540 suffit, le quart des pixels d'un fond
 * en 1920 (8,3 Mo décodés) et un peu plus de la moitié de 1280 (3,7 Mo) — 2 Mo.
 *
 * Le héros de l'accueil n'est pas un fond : c'est l'œuvre, en grand, au
 * premier plan. Il garde sa taille (1280) en Lite.
 *
 * Normal (et toujours sur l'Apple TV) : la largeur demandée, telle quelle.
 */
export const LITE_BACKDROP_WIDTH = 960;

/** La largeur à demander pour un fond plein écran, au niveau de rendu donné. */
export function backdropWidthFor(tier: RenderTier, width: number): number {
  return tier === "lite" ? Math.min(width, LITE_BACKDROP_WIDTH) : width;
}

/**
 * Lite : le temps qu'un écran qui recouvre toute l'interface (le lecteur) se
 * pose — l'écran recouvert caché, ses images relâchées — avant de vider les
 * caches d'images (`useReleaseHiddenImages`, Android TV).
 */
export const LITE_RELEASE_SETTLE_MS = 1200;
