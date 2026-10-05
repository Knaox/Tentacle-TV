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

/** Comment `react-native-svg` floute (`FeGaussianBlur`). */
export type SvgBlurRendering =
  /** L'écart-type écrit, en points (Core Image). */
  | "points"
  /** Android (patch Tentacle de react-native-svg) : RenderScript, rayon =
   *  2 × l'écart-type écrit, plafonné à 25, en pixels du dessin. */
  | "renderscript";

/** Comment se dessine le halo d'une œuvre (`ArtworkHalo`). */
export type HaloRendering =
  /** Un SVG flouté une fois, au dessin réduit (`haloDrawing`). */
  | "svg"
  /** Une forme floutée une fois PAR GÉOMÉTRIE (vue native `TentacleHaloView`),
   *  teinte par un dégradé au dessin : rien ne se floute quand l'œuvre change. */
  | "mask";

/** Comment se dessinent les lumières rondes (fond vivant, lueur d'un motif). */
export type LightRendering =
  /** Un disque SVG au dégradé radial, rastérisé petit puis agrandi. */
  | "svg"
  /** Un dégradé radial évalué par le GPU (vue native `TentacleGlowView`) :
   *  ni bitmap, ni rastérisation quand la couleur change. */
  | "shader";

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
  /** Le rendu des halos d'œuvre. */
  halos: HaloRendering;
  /** Le rendu des lumières rondes. */
  lights: LightRendering;
  /** Le flou SVG de la plateforme (voir `haloDrawing`). */
  svgBlur: SvgBlurRendering;
  /** Les images des CARTES demandées au serveur, en pixels : la largeur d'une
   *  vignette 16:9, la hauteur d'une affiche 2:3 (`CARD_ARTWORK`). */
  cardArtwork: CardArtworkSize;
  /** Les rangées d'une page montées par ÉCHELONS (`rowStaging`) : l'écran
   *  d'abord, le reste une part par image. Faux : tout d'un bloc. */
  stagedRows: boolean;
  /** Les pixels de l'interface par point : l'échelle à laquelle se demandent
   *  les images taillées « au double des points » (fiche, panneau, portraits).
   *  2 sur l'Apple TV 4K ; 1 sur Android TV, rendue en 1080p. */
  imageScale: number;
}

export interface CardArtworkSize {
  landscapeWidth: number;
  posterHeight: number;
}

/**
 * La taille des images des cartes, par plateforme :
 * - Apple TV : de quoi rester net à l'échelle 2 d'une Apple TV 4K ;
 * - Android TV : l'interface y est rendue en 1080p (un pixel par point — la
 *   Shield agrandit l'image entière vers la dalle 4K) : la plus grande carte,
 *   agrandie par le focus (× 1,08), et rien de plus — une vignette de 380
 *   points en fait 410, une affiche de grille (366) 395, celle d'une rangée
 *   (360) 389. Autant d'octets en moins à décoder, à garder en mémoire et à
 *   envoyer au GPU — l'envoi des textures est la part qui débordait d'une
 *   image au défilement (banc `android-perf`) —, pour une image que le GPU
 *   ne réduit plus qu'à peine : la même à l'œil, plus fine si quelque chose
 *   change.
 */
const CARD_ARTWORK: Readonly<Record<RenderPlatform, CardArtworkSize>> = {
  tvos: { landscapeWidth: 640, posterHeight: 480 },
  androidtv: { landscapeWidth: 412, posterHeight: 400 },
};

export const RENDER_PROFILES: Readonly<Record<RenderPlatform, Readonly<RenderProfile>>> = {
  tvos: {
    motion: true,
    nativeGlass: true,
    shadows: "layer",
    haloDrawScale: 0.25,
    halos: "svg",
    lights: "svg",
    svgBlur: "points",
    cardArtwork: CARD_ARTWORK.tvos,
    stagedRows: false,
    imageScale: 2,
  },
  // Android 11 (Shield TV Pro, Tegra X1+) : ni flou en direct, ni ombre
  // floutée en ancienne architecture — les ombres passent par un masque
  // précalculé, le verre est toujours dessiné (Liquid Glass y est coupé).
  androidtv: {
    motion: true,
    nativeGlass: false,
    shadows: "mask",
    haloDrawScale: 0.25,
    halos: "mask",
    lights: "shader",
    svgBlur: "renderscript",
    cardArtwork: CARD_ARTWORK.androidtv,
    // Le fil UI de la Shield ne crée pas 2 400 vues dans une image (`rowStaging`).
    stagedRows: true,
    imageScale: 1,
  },
};

/** Le profil d'une plateforme ; une plateforme inconnue reçoit le plus sobre
 *  (celui d'Android TV, qui ne suppose aucun effet natif). */
export function renderProfileOf(platform: string): Readonly<RenderProfile> {
  return platform === "tvos" ? RENDER_PROFILES.tvos : RENDER_PROFILES.androidtv;
}
