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
 * # Le facteur d'échelle est OBLIGATOIRE — mesuré le 28.08
 *
 * mpv lit `geometry` en pixels PHYSIQUES : nourri des bounds logiques
 * d'Electron sur l'écran ×2 du poste, il naissait moitié plus petit que
 * l'overlay (constaté par l'utilisateur, la colle étant morte par ailleurs).
 * On multiplie donc par l'échelle de l'écran de la fenêtre. Taille de
 * naissance SEULEMENT : `getDisplayMatching` peut se tromper d'écran sur
 * Wayland (`getBounds` ment — REPRISE §3.4) et l'échelle serait alors celle
 * d'un voisin — le premier `coller()` de la colle reste le juge de paix.
 *
 * # Pourquoi seulement wayland+libre
 *
 * Le montage imposé est plein écran par nature ; X11 a son propre calage
 * (`SurfaceX11.align`, sondage à 100 ms) — hors du périmètre mesuré.
 */

export function initialGeometryOption(
  montage: "wayland" | "x11" | null,
  windowing: "libre" | "plein-ecran" | null,
  bounds: { width: number; height: number },
  scaleFactor: number,
): Readonly<Record<string, string>> {
  if (montage !== "wayland" || windowing !== "libre") return {};
  // Une échelle folle ne doit pas fabriquer une fenêtre géante : repli à 1.
  const scale = Number.isFinite(scaleFactor) && scaleFactor >= 1 && scaleFactor <= 4
    ? scaleFactor
    : 1;
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);
  // Des bornes dégénérées (fenêtre pas encore mappée, valeurs folles) ne
  // doivent pas produire une geometry absurde : mieux vaut aucune option.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return {};
  if (width < 100 || height < 100) return {};
  return { geometry: `${width}x${height}` };
}
