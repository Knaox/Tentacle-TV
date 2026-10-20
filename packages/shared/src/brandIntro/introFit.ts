/**
 * L'écran du poulpe AUX PROPORTIONS DE L'APPAREIL (mobile, iPad). Le logo
 * porte un écran de télévision (124 × 92 unités) : sur un téléphone en
 * portrait, l'app s'y montrerait entre deux larges bandes. On en tire donc,
 * des constantes générées du logo — jamais redessiné —, un poulpe qui tient
 * un écran de la forme de la fenêtre :
 *
 * - l'écran garde son HAUT (la tête y est posée) et son centre horizontal ;
 *   son intérieur prend le rapport largeur / hauteur de la fenêtre, à surface
 *   égale à celle du logo, largeur bornée (les bras ne se touchent jamais au
 *   milieu, le poulpe ne s'étale pas sur un téléphone en paysage) ;
 * - les bras avant suivent les côtés (décalés d'autant) et s'allongent le
 *   long de l'écran : seul leur tronçon droit s'étire, l'épaule et la
 *   boucle du bas gardent leur dessin ; les ventouses suivent leur bras ;
 * - les pattes arrière suivent le bas de l'écran, le bouton lecture son
 *   centre, les dégradés de la vitre, des bras et du bouton leurs pièces.
 *
 * La tête, le visage et le chapeau ne bougent pas. Sur un écran déjà au
 * rapport du logo (la TV), rien ne change. Module pur, repère du logo.
 */
import { LOGO_CENTER, LOGO_UNITS, type IntroArt } from "./introGeometry";

/** Ce que l'adaptation touche, en plus de ce que lit la géométrie. */
export interface FittableArt extends IntroArt {
  SUCKERS: readonly { cx: number; cy: number; r: number }[];
  LOGO_GRADIENTS: Readonly<Record<string, { x1: number; y1: number; x2: number; y2: number }>>;
}

/** La surface de l'intérieur de l'écran du logo, gardée d'un format à l'autre. */
const LOGO_INNER_AREA = (124 - 5) * (92 - 5);

/**
 * Les bornes de la largeur de l'intérieur (unités) : en deçà, les boucles des
 * bras avant se rejoindraient sur le bouton lecture ; au-delà, l'écran
 * déborderait largement de la tête.
 */
export const INTRO_FIT_INNER_WIDTH = { min: 92, max: 160 } as const;

/** Le tronçon des bras avant qui s'étire (unités) : sous l'épaule, au-dessus de la boucle. */
const ARM_STRETCH = { from: 112, to: 160 } as const;

/** Le plus court que ce tronçon puisse devenir (un paysage très large). */
const ARM_MIN_STRETCH = 12;

export interface IntroFit {
  /** L'écran adapté (cadre centré sur son bord), comme `SCREEN`. */
  screen: { x: number; y: number; width: number; height: number };
  /** Le décalage horizontal de chaque côté vers le centre (négatif : vers l'extérieur). */
  inset: number;
  /** Ce que le bas de l'écran a gagné (négatif : perdu). */
  grow: number;
}

/** L'écran du logo pour une fenêtre de rapport `aspect` (largeur / hauteur). */
export function introFitFor(art: IntroArt, aspect: number): IntroFit {
  const { SCREEN } = art;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : (SCREEN.width - SCREEN.frameWidth) / (SCREEN.height - SCREEN.frameWidth);
  const innerWidth = Math.min(INTRO_FIT_INNER_WIDTH.max, Math.max(INTRO_FIT_INNER_WIDTH.min, Math.sqrt(LOGO_INNER_AREA * ratio)));
  const width = innerWidth + SCREEN.frameWidth;
  const height = innerWidth / ratio + SCREEN.frameWidth;
  const center = SCREEN.x + SCREEN.width / 2;
  return {
    screen: { x: center - width / 2, y: SCREEN.y, width, height },
    inset: (SCREEN.width - width) / 2,
    grow: height - SCREEN.height,
  };
}

/** Le déplacement vertical d'un point des bras avant : le tronçon droit s'étire, le reste suit. */
export function stretchArmY(y: number, grow: number): number {
  const { from, to } = ARM_STRETCH;
  const span = Math.max(ARM_MIN_STRETCH, to - from + grow);
  if (y <= from) return y;
  if (y <= to) return from + ((y - from) * span) / (to - from);
  return y + (from + span - to);
}

const numbersOf = (d: string): number[] => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

/** Un tracé fait de M, L et Z (les bras, le triangle lecture), point par point. */
export function mapPolyline(d: string, map: (x: number, y: number) => [number, number]): string {
  const values = numbersOf(d);
  const points: string[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    const [x, y] = map(values[index] as number, values[index + 1] as number);
    points.push(`${round(x)} ${round(y)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Le côté d'une pièce : −1 à gauche du centre du logo, +1 à droite. */
const sideOf = (x: number, center: number) => (x < center ? 1 : -1);

/**
 * Le logo dont l'écran a le rapport `aspect` (largeur / hauteur de la
 * fenêtre). Retourne le même type que reçu : la vue lit le résultat comme les
 * constantes générées elles-mêmes.
 */
export function fitIntroArt<T extends FittableArt>(art: T, aspect: number): T {
  const fit = introFitFor(art, aspect);
  const { inset, grow } = fit;
  const center = art.SCREEN.x + art.SCREEN.width / 2;
  if (Math.abs(inset) < 0.01 && Math.abs(grow) < 0.01) return art;
  const front = (side: number) => (x: number, y: number): [number, number] => [x + side * inset, stretchArmY(y, grow)];
  const back = (side: number) => (x: number, y: number): [number, number] => [x + side * inset, y + grow];
  const sideOfPath = (d: string) => sideOf(numbersOf(d)[0] ?? center, center);
  const shift = (spec: { x1: number; y1: number; x2: number; y2: number }, dy1: number, dy2: number) => ({ ...spec, y1: spec.y1 + dy1, y2: spec.y2 + dy2 });
  const gradients = { ...art.LOGO_GRADIENTS };
  // La vitre (gT) couvre l'écran ; les bras (gA) finissent sur les pattes ; le bouton (gP) suit son centre.
  if (gradients.gT) gradients.gT = shift(gradients.gT, 0, grow);
  if (gradients.gA) gradients.gA = shift(gradients.gA, 0, grow);
  if (gradients.gP) gradients.gP = shift(gradients.gP, grow / 2, grow / 2);
  return {
    ...art,
    SCREEN: { ...art.SCREEN, ...fit.screen },
    PLAY_PATH: mapPolyline(art.PLAY_PATH, (x, y) => [x, y + grow / 2]),
    FRONT_ARM_PATHS: art.FRONT_ARM_PATHS.map((d) => mapPolyline(d, front(sideOfPath(d)))),
    BACK_ARM_PATHS: art.BACK_ARM_PATHS.map((d) => mapPolyline(d, back(sideOfPath(d)))),
    SUCKERS: art.SUCKERS.map((cup) => ({ ...cup, cx: cup.cx + sideOf(cup.cx, center) * inset, cy: stretchArmY(cup.cy, grow) })),
    LOGO_GRADIENTS: gradients,
    // Le cadrage de départ : le logo s'allonge vers le bas.
    LOGO_FRAME: { cx: LOGO_CENTER.x, cy: LOGO_CENTER.y + grow / 2, height: LOGO_UNITS + Math.max(0, grow) },
  };
}
