/**
 * Le PROFIL DE RENDU d'une plateforme de salon : ce que ses vues dessinent,
 * et comment, pour le même écran. Une table de données, lue une fois au
 * chargement par l'app (`apps/tv/src/redesign/render/renderProfile.ts`) —
 * jamais un `Platform.OS` épars dans les vues. Une future version allégée
 * (« Lite ») sera une ligne de plus, pas une chasse aux conditions.
 *
 * Règle commune : un allègement ne se VOIT pas. L'Apple TV est la référence
 * du rendu ; ce qu'une autre plateforme dessine autrement (une ombre, un
 * gris, un verre) doit rester identique à l'œil nu.
 */

export type RenderPlatform = "tvos" | "androidtv";

/** Comment se dessine l'ombre portée d'une vue (`shadowColor`, `shadowRadius`…). */
export type ShadowRendering =
  /** Celle du système (CALayer) : les styles iOS, tels quels. */
  | "layer"
  /** Un masque flouté UNE fois (vue native `TentacleShadowView`), mis en
   *  cache par géométrie et teinté au dessin : aucun flou par image. */
  | "mask";

export interface RenderProfile {
  /** Le mouvement de la refonte (ressorts, fondus) sur le fil d'interface.
   *  Faux : chaque animation se pose aussitôt. */
  motion: boolean;
  /** Le verre natif du système (UIGlassEffect, tvOS 26) quand il existe.
   *  Faux : le verre dessiné, toujours. */
  nativeGlass: boolean;
  /** Le rendu des ombres portées. */
  shadows: ShadowRendering;
  /** L'échelle à laquelle un halo d'œuvre se floute avant d'être agrandi par
   *  le GPU (1 : à sa taille ; 0,25 : seize fois moins de pixels). */
  haloDrawScale: number;
  /** Pendant une animation de transformation (focus, appui), la vue est
   *  rendue dans une texture que le GPU déplace sans repeindre ses enfants
   *  (`renderToHardwareTextureAndroid`). Sans effet hors Android. */
  animatedLayerTexture: boolean;
  /** En production, `console.log` / `info` / `debug` ne font rien (chaque
   *  appel formate puis écrit dans le journal système, sur le fil JS). */
  muteReleaseLogs: boolean;
}

export const RENDER_PROFILES: Readonly<Record<RenderPlatform, Readonly<RenderProfile>>> = {
  tvos: {
    motion: true,
    nativeGlass: true,
    shadows: "layer",
    haloDrawScale: 0.25,
    animatedLayerTexture: false,
    muteReleaseLogs: false,
  },
  // Android 11 (Shield TV Pro, Tegra X1+) : ni flou en direct, ni ombre
  // floutée en ancienne architecture — les ombres passent par un masque
  // précalculé, le verre est toujours dessiné (Liquid Glass y est coupé).
  androidtv: {
    motion: true,
    nativeGlass: false,
    shadows: "mask",
    haloDrawScale: 0.25,
    animatedLayerTexture: true,
    muteReleaseLogs: true,
  },
};

/** Le profil d'une plateforme ; une plateforme inconnue reçoit le plus sobre
 *  (celui d'Android TV, qui ne suppose aucun effet natif). */
export function renderProfileOf(platform: string): Readonly<RenderProfile> {
  return platform === "tvos" ? RENDER_PROFILES.tvos : RENDER_PROFILES.androidtv;
}
