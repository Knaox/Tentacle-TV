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
 * # Pourquoi PAS de facteur d'échelle
 *
 * Selon que mpv lit la valeur en pixels physiques ou logiques (écran à
 * échelle fractionnaire), multiplier par l'échelle pourrait DOUBLER la
 * fenêtre — pire que le mal. La valeur logique nue donne au pire une fenêtre
 * plus petite que la cible, jamais une illusion de plein écran, et le premier
 * `coller()` corrige. À réviser au banc si l'écart se voit.
 *
 * # Pourquoi seulement wayland+libre
 *
 * Le montage imposé est plein écran par nature ; X11 a son propre calage
 * (`SurfaceX11.align`, sondage à 100 ms) — hors du périmètre mesuré.
 */

export function initialGeometryOption(
  montage: "wayland" | "x11" | null,
  fenetrage: "libre" | "plein-ecran" | null,
  bounds: { width: number; height: number },
): Readonly<Record<string, string>> {
  if (montage !== "wayland" || fenetrage !== "libre") return {};
  const largeur = Math.floor(bounds.width);
  const hauteur = Math.floor(bounds.height);
  // Des bornes dégénérées (fenêtre pas encore mappée, valeurs folles) ne
  // doivent pas produire une geometry absurde : mieux vaut aucune option.
  if (!Number.isFinite(largeur) || !Number.isFinite(hauteur)) return {};
  if (largeur < 100 || hauteur < 100) return {};
  return { geometry: `${largeur}x${hauteur}` };
}
