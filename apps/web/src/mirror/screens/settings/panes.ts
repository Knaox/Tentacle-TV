/**
 * La mise en page du profil miroir (le catalogue des réglages, lui, est
 * partagé : `@tentacle-tv/shared` › settingsCatalog ; ce que le web y ajoute :
 * `catalog/webCatalog.ts`). Module pur.
 */

/** Sous cette largeur utile, deux colonnes écraseraient le détail (`SPLIT_MIN_WIDTH` de l'app). */
export const SPLIT_MIN_WIDTH = 720;

/** Le maître-détail : une tablette dont la largeur utile (rail ôté) atteint 720. */
export function isProfileSplit(isTablet: boolean, width: number, railWidth: number): boolean {
  return isTablet && width - railWidth >= SPLIT_MIN_WIDTH;
}

/** Largeur de la liste maîtresse : 34 % de l'écran, bornée 320-400. */
export function masterWidth(width: number): number {
  return Math.round(Math.min(400, Math.max(320, width * 0.34)));
}
