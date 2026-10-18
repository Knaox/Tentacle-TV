/**
 * La géométrie de l'ouverture, tirée des pièces du logo — jamais recopiée :
 * chaque plateforme passe SES constantes générées par `brand/generate-svg.py`
 * (`tentacleArt.generated.ts`, `tentacleArmPaths.generated.ts`), et l'on en
 * déduit ici l'écran, le bouton lecture, les pivots des bras. Repère du logo :
 * 240 × 240 unités.
 */

export interface IntroPoint {
  x: number;
  y: number;
}

export interface IntroBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ce que l'ouverture lit des constantes générées du logo. */
export interface IntroArt {
  SCREEN: { x: number; y: number; width: number; height: number; rx: number; frameWidth: number };
  PLAY_PATH: string;
  FRONT_ARM_PATHS: readonly string[];
  BACK_ARM_PATHS: readonly string[];
  EYE_WHITES: readonly { cx: number; cy: number; r: number }[];
}

/** Le rectangle arrondi d'un écran (vitre, cadre, intérieur). */
export interface IntroRoundedRect extends IntroBox {
  rx: number;
}

export interface IntroGeometry {
  /** L'écran du logo (vitre), cadre centré sur son bord. */
  screen: IntroRoundedRect;
  /** L'épaisseur du cadre. */
  frame: number;
  /** L'INTÉRIEUR du cadre : ce que la page remplit à l'arrivée. */
  inner: IntroRoundedRect;
  /** Le bord EXTÉRIEUR du cadre. */
  outer: IntroRoundedRect;
  /** Le centre de l'écran : le point que la caméra vise. */
  target: IntroPoint;
  /** Le centre du triangle « lecture » (moyenne de ses sommets). */
  play: IntroPoint;
  /** Du bouton lecture au coin de l'écran le plus lointain : le cercle qui ouvre la vitre doit l'atteindre. */
  reach: number;
  /** Les pivots des bras avant (l'épaule, en haut de leur encombrement), gauche puis droit. */
  frontArmPivots: readonly IntroPoint[];
  /** Les pivots des bras arrière (leur racine, en haut de leur encombrement). */
  backArmPivots: readonly IntroPoint[];
  frontArmBounds: readonly IntroBox[];
  backArmBounds: readonly IntroBox[];
  /** Les centres des yeux (le clin d'œil s'y écrase). */
  eyes: readonly IntroPoint[];
}

/** Le centre de l'encombrement du logo, chapeau compris (le cadrage de départ). */
export const LOGO_CENTER: IntroPoint = { x: 120, y: 122 };
export const LOGO_UNITS = 240;

const numbersOf = (d: string): number[] => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

/** L'encombrement d'un tracé fait de M, L et Z (les bras, le triangle lecture). */
export function pathBounds(d: string): IntroBox {
  const values = numbersOf(d);
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function centroid(d: string): IntroPoint {
  const values = numbersOf(d);
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  return { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
}

const inset = (rect: IntroRoundedRect, by: number): IntroRoundedRect => ({
  x: rect.x + by,
  y: rect.y + by,
  width: rect.width - by * 2,
  height: rect.height - by * 2,
  rx: Math.max(0, rect.rx - by),
});

export function introGeometry(art: IntroArt): IntroGeometry {
  const { SCREEN } = art;
  const screen: IntroRoundedRect = { x: SCREEN.x, y: SCREEN.y, width: SCREEN.width, height: SCREEN.height, rx: SCREEN.rx };
  const half = SCREEN.frameWidth / 2;
  const play = centroid(art.PLAY_PATH);
  const corners: [number, number][] = [
    [screen.x, screen.y],
    [screen.x + screen.width, screen.y],
    [screen.x, screen.y + screen.height],
    [screen.x + screen.width, screen.y + screen.height],
  ];
  const reach = Math.max(...corners.map(([x, y]) => Math.hypot(x - play.x, y - play.y))) + 4;
  const frontArmBounds = art.FRONT_ARM_PATHS.map(pathBounds);
  const backArmBounds = art.BACK_ARM_PATHS.map(pathBounds);
  return {
    screen,
    frame: SCREEN.frameWidth,
    inner: inset(screen, half),
    outer: inset(screen, -half),
    target: { x: screen.x + screen.width / 2, y: screen.y + screen.height / 2 },
    play,
    reach,
    frontArmBounds,
    backArmBounds,
    // Comme le site : l'épaule à 8 unités du haut, la racine à 6.
    frontArmPivots: frontArmBounds.map((box) => ({ x: box.x + box.width / 2, y: box.y + 8 })),
    backArmPivots: backArmBounds.map((box) => ({ x: box.x + box.width / 2, y: box.y + 6 })),
    eyes: art.EYE_WHITES.map((eye) => ({ x: eye.cx, y: eye.cy })),
  };
}
