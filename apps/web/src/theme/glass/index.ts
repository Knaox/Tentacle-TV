/**
 * Liquid Glass — la primitive. API STABLE : les autres chantiers du lot
 * (lecteur, fenêtre, composants, physique) s'en servent ; un changement ici se
 * dit au coordinateur.
 *
 * ── Les trois modes (`<html data-liquid-glass>`, voir `../liquidGlassMode.ts`)
 *  - `native`     macOS 26 + réglage allumé : le verre ;
 *  - `refraction` réglage allumé, sans verre natif (web, Windows, Linux, macOS < 26) ;
 *  - `off`        réglage coupé.
 *  Hors `native`, une surface rend `className` + `fallbackClassName` +
 *  `fallbackStyle` + `style` et RIEN d'autre : le rendu d'avant, au pixel près.
 *
 * ── Le rendu d'une surface en mode `native`, selon `backdrop`
 *  - `backdrop="page"` (défaut) : ce qui est derrière est de la PAGE (affiches,
 *    texte). Le verre natif ne peut pas le voir — il vit SOUS la vue web. La
 *    surface rend la LENTILLE de Chromium (refonte du 22/10, cible Apple) :
 *    presque transparente, givre faible, réfraction physique AU BISEAU calculée
 *    pour sa forme exacte (Snell, `@tentacle-tv/ui` lensProfile), lumière du
 *    bord (liseré face à la lumière) dans le même filtre, ombre qui soulève, et
 *    glyphes au TON du dessous (`data-lg-tone`, mesuré par la coquille).
 *    Une recette qui monte `RefractionFilter` elle-même (`useLensGeometry`) :
 *    `backdrop-filter: <givre, saturation, luminosité> url(#lentille)` — les
 *    fonctions AVANT `url()`, sinon le liseré est flouté ; et `useBackdropTone`
 *    pour la polarité de ses glyphes.
 *  - `backdrop="window"` : la page est transparente jusqu'à la fenêtre (le
 *    lecteur sur la vidéo de mpv, une barre latérale sur le fond). La surface
 *    s'inscrit auprès de la coquille (NSGlassEffectView au même rectangle,
 *    suivi image par image) et se rend TRANSPARENTE ; l'appelant garantit que
 *    ses ancêtres le sont aussi.
 *
 * ── Options (`LiquidGlassAppearance`)
 *  - `level`  `regular` (défaut) · `clear` (sur média vif) · `tinted` (marque
 *             en touche) · `prominent` (action principale) ;
 *  - `shape`  `rounded` (défaut, coins continus) · `capsule` · `circle` · `rect` ;
 *  - `radius` d'un `rounded` : `xs` · `sm` · `md` (défaut) · `lg` · `xl` ;
 *  - `tint`   des niveaux teintés : `brand` (défaut, violet → rose) · `accent` (rose) ;
 *  - `interactive` réagit au pointeur (le natif l'anime ; la lentille expose
 *             `data-lg-interactive` pour les règles de lg-physique) ;
 *  - `z`      ordre des verres natifs entre eux ;
 *  - `scale`  le RÉGIME, selon la taille (lot lg2) : `control` (défaut :
 *             bouton, capsule — le ton suit le dessous et bascule) ·
 *             `surface` (menu, popover, feuille, barre latérale, palette —
 *             `data-lg-scale="surface"` : UN ton tenu, matériau épais, jamais
 *             de bandes ; jetons du contrat dans `surfaceTokens.css`) ;
 *  - `group`, `spacing`, `transition` (verre NATIF seulement) : groupe de
 *             fusion (NSGlassEffectContainerView : voisines, les régions
 *             fusionnent et se métamorphosent), sa distance de fusion en pt,
 *             les animations natives d'apparition, de déplacement et de retrait
 *             en ms — la page ne pousse pas un rectangle par image pour animer.
 *
 * ── Le LABO : `/dev/verre` (paquets de développement seulement) — un
 *    exemple de chaque surface sur de vrais dessous ; on y juge avant de
 *    propager (`dev/glassLab/`).
 *
 * ── Les portes
 *  - `useLiquidGlassMode() === "native"` : le verre est là (OS + réglage) ;
 *  - `useLiquidGlass().nativeSupported` / `nativeGlassBridge() !== null` :
 *    l'OS l'offre, réglage mis à part (écran des nouveautés) ;
 *  - `useLiquidGlass().refractsVideo` / `nativeGlassRefractsVideo()` : le verre
 *    natif voit la VIDÉO (montage `fenetre`, Apple Silicon) — sans lui, le
 *    lecteur garde son rendu d'avant sur l'image ;
 *  - `useLiquidGlassRegion(…)` rend `true` quand la région est NATIVE : ne
 *    rien peindre de plus dessous (la teinte vient du verre natif).
 *
 * ── Les règles à tenir
 *  - `className` = MISE EN PAGE seulement (position, taille, marges, flex).
 *    Couleurs, flous, liserés, ombres, rayons : dans `fallbackClassName` pour
 *    le rendu d'avant ; le verre les tient de ses jetons (`--lg-*`).
 *  - Une feuille qui retouche le verre lit des jetons et se porte par
 *    `:root[data-liquid-glass="native"]` — un test le vérifie
 *    (`liquidGlassTokens.test.ts`).
 *  - Les règles de mouvement (suivi du pointeur, lentille à l'appui, ressorts)
 *    écrivent `--lg-light-x` / `--lg-light-y` et ciblent
 *    `.lg-surface[data-lg-interactive]` : rien d'autre à brancher.
 *  - Ce qui n'est pas affiché ne doit rien coûter : démonter une surface
 *    cachée plutôt que la masquer par l'opacité (CLAUDE.md, « Coût GPU »).
 */

export { LiquidGlass, type LiquidGlassProps } from "./LiquidGlass";
export {
  useLiquidGlassSurface,
  type LiquidGlassSurface,
  type LiquidGlassSurfaceOptions,
  type LiquidGlassSurfaceProps,
} from "./useLiquidGlassSurface";
export { useLiquidGlassRegion, type LiquidGlassRegionOptions } from "./useLiquidGlassRegion";
export { useBackdropTone } from "./useBackdropTone";
export type { BackdropTone } from "./backdropTone";
export { useLensGeometry, type LensGeometry } from "./useLensGeometry";
export {
  resolveSurfaceRender,
  scaleAttributes,
  type LiquidGlassAppearance,
  type LiquidGlassBackdrop,
  type LiquidGlassLevel,
  type LiquidGlassRadius,
  type LiquidGlassScale,
  type LiquidGlassShape,
  type LiquidGlassTint,
  type SurfaceRender,
} from "./surfaceModel";
export { useLiquidGlassMode } from "../useLiquidGlass";
export {
  getLiquidGlassMode,
  nativeGlassBridge,
  nativeGlassRefractsVideo,
  type LiquidGlassMode,
} from "../liquidGlassMode";

// ── Le « liquide » (lg-physique) : ressorts, lentille, reflet qui suit le
// pointeur, fusion et métamorphose des formes, accessibilité du système,
// contraste. Règles pures + petites briques ; la feuille est `physics.css`.
export * from "./springs";
export * from "./specular";
export * from "./fusion";
export * from "./accessibility";
export * from "./contrast";
export * from "./glassMotion";
export { useSpecularHighlight } from "./useSpecularHighlight";
export { GlassSpecular, GLASS_LENS_PROPS } from "./GlassSpecular";
export { GlassFusion, type GlassFusionProps } from "./GlassFusion";
