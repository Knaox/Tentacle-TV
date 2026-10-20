/**
 * L'écran qui S'ALLUME aux proportions de l'appareil (mobile, iPad), le logo
 * INTACT. Le poulpe garde son écran de télévision (124 × 92 unités) et ses
 * proportions exactes, quelle que soit la fenêtre : il n'est jamais redessiné,
 * jamais étiré — la caméra ne le grandit que d'un facteur unique. Seule la
 * FENÊTRE allumée, dans sa vitre, prend la forme de l'appareil : un téléphone
 * en portrait s'allume en colonne au milieu de la vitre, en paysage en bande,
 * l'iPad presque plein. La vitre sombre reste autour ; la plongée s'arrête
 * quand cette fenêtre recouvre l'écran de l'appareil.
 *
 * Retour de Damien du 2026-10-21 (alpha mobile) : l'ancien `fitIntroArt`, qui
 * allongeait l'écran du logo et ses bras au rapport du téléphone, « dénaturait »
 * le poulpe. Module pur, repère du logo.
 */
import type { IntroRoundedRect } from "./introGeometry";

/** La vitre qu'on laisse voir autour de la fenêtre allumée (unités du logo). */
export const INTRO_LIT_MARGIN = 3;

/** L'arrondi de la fenêtre allumée, rapporté à son plus petit côté (les coins d'un téléphone). */
export const INTRO_LIT_CORNER = 0.1;

/**
 * La fenêtre allumée pour une fenêtre d'appareil de rapport `aspect`
 * (largeur / hauteur) : la plus grande de ce rapport qui tienne dans
 * l'intérieur de l'écran (moins sa marge de vitre), centrée sur lui. Sans
 * rapport (la TV), l'intérieur entier : rien ne change.
 */
export function introLitWindow(inner: IntroRoundedRect, aspect?: number | null): IntroRoundedRect {
  if (aspect === undefined || aspect === null || !Number.isFinite(aspect) || aspect <= 0) return inner;
  const room = { width: inner.width - INTRO_LIT_MARGIN * 2, height: inner.height - INTRO_LIT_MARGIN * 2 };
  const width = Math.min(room.width, room.height * aspect);
  const height = width / aspect;
  return {
    x: inner.x + (inner.width - width) / 2,
    y: inner.y + (inner.height - height) / 2,
    width,
    height,
    rx: Math.min(width, height) * INTRO_LIT_CORNER,
  };
}
