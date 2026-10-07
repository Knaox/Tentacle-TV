/**
 * Le PROFIL DE RENDU d'une plateforme de salon : ce que ses vues dessinent,
 * et comment, pour le même écran. Une table de données, lue une fois au
 * chargement par l'app (`apps/tv/src/redesign/render/renderProfile.ts`) —
 * jamais un `Platform.OS` épars dans les vues. La version allégée d'Android
 * TV (« Lite ») est une VARIANTE de son profil (`liteProfile.ts`), choisie par
 * le niveau de rendu de l'appareil : une ligne de plus, pas une chasse aux
 * conditions.
 *
 * Règle commune (hors Lite) : un allègement ne se VOIT pas. L'Apple TV est la référence
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
  | "mask"
  /** Un bord fin à la place de l'ombre (Lite) : rien ne se floute ni ne déborde. */
  | "border";

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

/** Le style du mouvement (`motion` vrai) : les préréglages tels quels, ou
 *  BREFS — chaque ressort devient un fondu court, les durées sont bornées et
 *  ce qui accompagne seulement (une image qui se pose) se pose sans animer
 *  (`liteMotion`). */
export type MotionStyle = "full" | "brief";

/** L'habit du focus d'une carte. */
export type CardFocusRendering =
  /** Elle grandit (× 1,08), se soulève, son ombre ou sa lueur s'allume, un reflet passe. */
  | "lift"
  /** Un liseré d'accent, à sa taille : ni agrandissement, ni ombre, ni reflet. */
  | "outline";

/** Le fond de la scène. */
export type AmbientRendering =
  /** Le fond vivant : trois lumières aux couleurs de l'œuvre, en fondu. */
  | "lights"
  /** Une seule teinte de l'œuvre, statique, venue d'en haut : un fondu court
   *  quand l'œuvre change, rien d'autre. */
  | "tint";

/** Ce dont le fond prend la couleur. */
export type AmbientFollow =
  /** L'œuvre qui a le FOCUS : chaque pas d'une carte à l'autre change la
   *  lumière, en fondu. */
  | "focus"
  /** L'œuvre de l'ÉCRAN (le héros, la fiche, la première carte) : le focus
   *  qui passe d'une carte à l'autre ne change rien au fond. */
  | "screen";

/** Le verre dessiné (sans verre natif). */
export type GlassRendering =
  /** Un voile, un reflet dégradé, un bord et un liseré allumé. */
  | "layered"
  /** Un aplat de la même teinte et un bord fin : une seule vue. */
  | "flat";

/** Les dégradés doux (`SoftGradient`). */
export type GradientRendering =
  /** Tous les arrêts écrits. */
  | "smooth"
  /** Deux arrêts, calés sur le gros de la variation (`twoStopGradient`). */
  | "twoStop";

/** Le passage d'un écran à l'autre de la pile. */
export type PageTransition = "fade" | "cut";

/** Comment se dessine l'indicateur d'activité (`ActivityIndicator`). */
export type SpinnerRendering =
  /** Celui du système (UIActivityIndicatorView) : la référence. */
  | "system"
  /** Redessiné à l'identique de l'Apple TV (vue native `TentacleSpinnerView`,
   *  `activitySpinner`) : huit rayons, 20 images par seconde. */
  | "drawn";

export interface RenderProfile {
  /** Le mouvement de la refonte (ressorts, fondus) sur le fil d'interface.
   *  Faux : chaque animation se pose aussitôt. */
  motion: boolean;
  /** Les fondus suivent les IMAGES rendues : une image en retard (un montage
   *  qui retient le fil d'interface) n'avance la course que de deux images —
   *  le fondu se voit en entier au lieu d'être fini avant sa première image.
   *  Faux : l'horloge murale. */
  steadyMotion: boolean;
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
  /** Les cartes d'une liste qui change ENTIÈRE à chaque réponse (les
   *  résultats d'une frappe) gardent leurs vues : clées par leur PLACE, elles
   *  se redessinent avec le titre suivant au lieu d'être démontées et
   *  d'autres montées. Faux : clées par leur titre. */
  recycleResultCards: boolean;
  /** Les pixels de l'interface par point : l'échelle à laquelle se demandent
   *  les images taillées « au double des points » (fiche, panneau, portraits).
   *  2 sur l'Apple TV 4K ; 1 sur Android TV, rendue en 1080p. */
  imageScale: number;
  /** L'indicateur d'activité. */
  spinner: SpinnerRendering;
  /** Ce qui est hors de l'écran sort de la liste d'affichage (pistes de cartes,
   *  sections — vues natives `TentacleCullTrack`, `TentacleFocusSection`) :
   *  monté et focalisable, le RenderThread ne le parcourt plus. */
  cullOffscreen: boolean;
  /** Le recul des voisines d'une carte joué par la piste native
   *  (`TentacleCullTrack` → `RowRecede`) plutôt que par Reanimated, carte par
   *  carte, sur le fil d'interface. */
  nativeRecede: boolean;
  /** Le style du mouvement. */
  motionStyle: MotionStyle;
  /** L'habit du focus des cartes. */
  cardFocus: CardFocusRendering;
  /** Le fond de la scène. */
  ambient: AmbientRendering;
  /** Ce que le fond suit : la carte focalisée, ou l'écran. */
  ambientFollow: AmbientFollow;
  /** Le verre dessiné. */
  glass: GlassRendering;
  /** Les dégradés doux. */
  gradients: GradientRendering;
  /** Le passage d'un écran à l'autre. */
  pageTransition: PageTransition;
  /** L'attente du héros entre deux titres, en multiple de celle de tv-core
   *  (`heroRotateDelay`). */
  heroDelayFactor: number;
  /** Le texte du héros qui tourne s'échange en fondu (faux : posé d'un coup,
   *  seule l'image fond). */
  heroTextSwap: boolean;
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
    steadyMotion: false,
    nativeGlass: true,
    shadows: "layer",
    haloDrawScale: 0.25,
    halos: "svg",
    lights: "svg",
    svgBlur: "points",
    cardArtwork: CARD_ARTWORK.tvos,
    stagedRows: false,
    recycleResultCards: false,
    imageScale: 2,
    spinner: "system",
    cullOffscreen: false,
    nativeRecede: false,
    motionStyle: "full",
    cardFocus: "lift",
    ambient: "lights",
    ambientFollow: "focus",
    glass: "layered",
    gradients: "smooth",
    pageTransition: "fade",
    heroDelayFactor: 1,
    heroTextSwap: true,
  },
  // Android 11 (Shield TV Pro, Tegra X1+) : ni flou en direct, ni ombre
  // floutée en ancienne architecture — les ombres passent par un masque
  // précalculé, le verre est toujours dessiné (Liquid Glass y est coupé).
  androidtv: {
    motion: true,
    // Monter ce qui paraît retient le fil d'interface de la Shield 100 à
    // 400 ms : à l'horloge murale, un fondu de 140 ms y était fini avant sa
    // première image (la pilule du décompte qui apparaît d'un coup).
    steadyMotion: true,
    nativeGlass: false,
    shadows: "mask",
    haloDrawScale: 0.25,
    halos: "mask",
    lights: "shader",
    svgBlur: "renderscript",
    cardArtwork: CARD_ARTWORK.androidtv,
    // Le fil UI de la Shield ne crée pas 2 400 vues dans une image (`rowStaging`).
    stagedRows: true,
    // Une frappe remplace ~25 cartes : les monter retenait le fil UI de la
    // Shield 100 à 150 ms (275 vues créées, banc « recherche-frappe »).
    recycleResultCards: true,
    imageScale: 1,
    // L'indicateur système d'Android est un autre dessin (un arc Material) :
    // celui de l'Apple TV, redessiné (`activitySpinner`).
    spinner: "drawn",
    // Le RenderThread de la Shield parcourt tout l'arbre à chaque image
    // (React Native ne rogne rien) : ~16 ms à l'accueil, dont l'essentiel hors
    // de l'écran (trace Skia, 2026-10-05).
    cullOffscreen: true,
    // Une vingtaine de cartes reculent à chaque pas vertical : ~4 ms de fil
    // d'interface par image sur la Shield, quand Reanimated les animait.
    nativeRecede: true,
    motionStyle: "full",
    cardFocus: "lift",
    ambient: "lights",
    ambientFollow: "focus",
    glass: "layered",
    gradients: "smooth",
    pageTransition: "fade",
    heroDelayFactor: 1,
    heroTextSwap: true,
  },
};

/** Le profil d'une plateforme ; une plateforme inconnue reçoit le plus sobre
 *  (celui d'Android TV, qui ne suppose aucun effet natif). */
export function renderProfileOf(platform: string): Readonly<RenderProfile> {
  return platform === "tvos" ? RENDER_PROFILES.tvos : RENDER_PROFILES.androidtv;
}
