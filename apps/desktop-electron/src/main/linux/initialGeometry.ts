/**
 * Taille de NAISSANCE de la fenêtre mpv — montage fenêtré libre (colle KDE).
 *
 * Sans option `geometry`, mpv dimensionne sa première fenêtre d'après le
 * MÉDIA : un 4K sur un écran de même taille donne une fenêtre grande comme
 * l'écran, sans bordure (`noBorder`) — indiscernable d'un plein écran pendant
 * ~0,5 s, jusqu'à ce que la colle KWin la cale sous la fenêtre hôte (l'éclair
 * signalé par l'utilisateur le 28.08). Naître à la taille de l'hôte supprime
 * l'illusion ; la colle affine ensuite.
 *
 * # Pourquoi la TAILLE seule
 *
 * Sous Wayland, la position d'une `geometry` est ignorée — le compositeur
 * place. La colle recopie la géométrie complète de l'hôte dès l'adoption.
 *
 * # Le facteur d'échelle est OBLIGATOIRE, et c'est la PAGE qui le dit
 *
 * mpv lit `geometry` en pixels PHYSIQUES : nourri de la taille logique de la
 * page sur l'écran ×2 du poste, il naissait moitié plus petit que l'overlay
 * (mesuré le 28.08). L'échelle vient de `devicePixelRatio`, mesuré par la page
 * (`displayTarget.ts`) — et JAMAIS de `screen.getDisplayMatching(getBounds())` :
 * sur Wayland `getBounds` rend (0,0) et désigne l'écran à l'origine, dont
 * l'échelle peut être une autre. Mesuré le 17.09.2026 : ×1,25 lue pour une
 * fenêtre posée sur un écran ×2. Taille de naissance SEULEMENT : le premier
 * `coller()` de la colle reste le juge de paix.
 *
 * # Pourquoi seulement wayland+libre
 *
 * Le montage imposé est plein écran par nature ; X11 a son propre calage
 * (`SurfaceX11.align`, sondage à 100 ms) — hors du périmètre mesuré.
 */

import type { PageMeasure } from "./displays";

export function initialGeometryOption(
  montage: "wayland" | "x11" | null,
  windowing: "libre" | "plein-ecran" | null,
  measure: PageMeasure | null,
): Readonly<Record<string, string>> {
  if (montage !== "wayland" || windowing !== "libre" || measure === null) return {};
  // Une échelle folle ne doit pas fabriquer une fenêtre géante : repli à 1.
  const scale = Number.isFinite(measure.density) && measure.density >= 1 && measure.density <= 4
    ? measure.density
    : 1;
  const width = Math.round(measure.width * scale);
  const height = Math.round(measure.height * scale);
  // Une mesure dégénérée (page pas encore peinte, valeurs folles) ne doit pas
  // produire une geometry absurde : mieux vaut aucune option.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return {};
  if (width < 100 || height < 100) return {};
  return { geometry: `${String(width)}x${String(height)}` };
}
