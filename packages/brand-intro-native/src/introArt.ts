import type { IntroArt, IntroBox, IntroGeometry } from "@tentacle-tv/shared/brandIntro";

/**
 * Ce que la vue de l'ouverture lit des constantes GÉNÉRÉES du logo
 * (`components/icons/tentacleArt.generated.ts`, par `brand/generate-svg.py`) :
 * le branchement les lui passe — une vue de la refonte n'importe rien de
 * l'app, et le logo ne se dessine qu'à un seul endroit.
 */
export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface LinearGradientSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly GradientStop[];
}

export interface TentacleArt extends IntroArt {
  HEAD_PATH: string;
  SHINE_PATH: string;
  EYE_PUPILS: readonly { cx: number; cy: number; r: number }[];
  EYE_GLINTS: readonly { cx: number; cy: number; r: number }[];
  CHEEKS: readonly { cx: number; cy: number; rx: number; ry: number }[];
  SMILE_PATH: string;
  HAT_TRANSFORM: string;
  HAT_PATH: string;
  HAT_BAND_PATH: string;
  SKULL_PATH: string;
  SUCKERS: readonly { cx: number; cy: number; r: number }[];
  SUCKER_SHADOW: { x: number; y: number; scale: number };
  LOGO_GRADIENTS: Readonly<Record<"gV" | "gHd" | "gA" | "gT" | "gS" | "gP" | "gH", LinearGradientSpec>>;
  LOGO_INK: string;
  LOGO_COLORS: { cheek: string; cheekOpacity: number; skull: string; skullEyes: string; sucker: string; suckerOpacity: number };
}

/** Une pièce de la scène : où elle se pose (unités du logo). */
export type PartBox = IntroBox;

const grow = (box: IntroBox, by: number): PartBox => ({ x: box.x - by, y: box.y - by, width: box.width + by * 2, height: box.height + by * 2 });

/** Les encombrements des pièces, tirés de la géométrie (une marge pour l'anticrénelage). */
export function partBoxes(geometry: IntroGeometry) {
  const { play, reach, outer } = geometry;
  return {
    /** La lueur : un disque de rayon 250 autour de (120, 136). */
    glow: { x: 120 - 250, y: 136 - 250, width: 500, height: 500 },
    head: { x: 64, y: 30, width: 112, height: 80 },
    /** Les yeux, les joues, la bouche : au-dessus de l'écran. */
    face: { x: 70, y: 64, width: 100, height: 40 },
    hat: { x: 56, y: 2, width: 128, height: 62 },
    frame: outer,
    backArms: geometry.backArmBounds.map((box) => grow(box, 2)),
    frontArms: geometry.frontArmBounds.map((box) => grow(box, 2)),
    eyes: geometry.eyes.map((eye) => ({ x: eye.x - 17, y: eye.y - 17, width: 34, height: 34 })),
    /** Le bouton lecture et son trait arrondi. */
    play: { x: play.x - 22, y: play.y - 22, width: 44, height: 44 },
    /** L'onde, au repos à son rayon de 26. */
    ring: { x: play.x - 28, y: play.y - 28, width: 56, height: 56 },
    /** L'éclair, à la portée du cercle qui ouvre la vitre. */
    flash: { x: play.x - reach, y: play.y - reach, width: reach * 2, height: reach * 2 },
  } as const;
}

export type PartBoxes = ReturnType<typeof partBoxes>;
