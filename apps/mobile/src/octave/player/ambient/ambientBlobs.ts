/**
 * Octave (mobile) — les TACHES de couleur du fond du lecteur (`ambientBlobs.test.ts`) : plusieurs teintes de la
 * pochette, pas une seule. Chaque tache montre une RÉGION différente de la pochette (un coin, le centre),
 * agrandie, floutée et fondue en disque doux ; elles sont posées en des points éloignés de l'écran et y dérivent
 * lentement, en battant au tempo (`ambientBeat`). Aucune couleur n'est lue ni calculée : c'est la pochette
 * elle-même, cadrée autrement — la couleur d'une tache est celle de sa région.
 */

import type { AmbientLayer } from "./ambientMotion";

/** La vignette des taches (px) : la plus petite du serveur, le flou fait le reste. */
export const BLOB_ARTWORK_SIZE = 64;
/** L'agrandissement d'une région : un peu moins de la moitié de la pochette par tache. */
export const BLOB_ZOOM = 2.4;

/** Les régions de la pochette (centre de la région, en part de la pochette). */
const REGIONS: readonly (readonly [number, number])[] = [
  [0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78], [0.5, 0.5],
];
/** Où se tiennent les taches (centre, en part de l'écran) : en haut à gauche, à droite au milieu, en bas. */
const ANCHORS = [
  { x: 0.2, y: 0.18, size: 0.8, opacity: 0.8, pulse: 1 },
  { x: 0.88, y: 0.48, size: 0.7, opacity: 0.7, pulse: 0.7 },
  { x: 0.28, y: 0.86, size: 0.75, opacity: 0.65, pulse: 0.85 },
] as const;
const PERIODS = [30, 40, 48, 60, 80] as const;

export interface AmbientBlob {
  /** Centre de la tache (part de la largeur, de la hauteur de l'écran). */
  anchorX: number;
  anchorY: number;
  /** Diamètre (part du plus grand côté de l'écran). */
  size: number;
  /** Centre de la région de la pochette montrée (0..1). */
  focusX: number;
  focusY: number;
  opacity: number;
  /** Ce que le battement lui ajoute d'échelle (au temps fort). */
  pulseScale: number;
  /** Sa dérive (mêmes règles que les calques : `layerTransform`). */
  drift: AmbientLayer;
}

function pick(seed: number, salt: number): number {
  const x = Math.sin((seed % 100003) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Les régions, dans un ordre propre au titre : jamais deux taches sur la même région. */
function regionOrder(seed: number): (readonly [number, number])[] {
  return REGIONS.map((region, i) => ({ region, rank: pick(seed, 40 + i) }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.region);
}

export function ambientBlobs(seed: number): AmbientBlob[] {
  const regions = regionOrder(seed);
  return ANCHORS.map((anchor, i) => ({
    anchorX: anchor.x,
    anchorY: anchor.y,
    size: anchor.size,
    focusX: regions[i][0],
    focusY: regions[i][1],
    opacity: anchor.opacity,
    pulseScale: 0.07 * anchor.pulse,
    drift: {
      opacity: 1,
      scale: 1,
      scaleSwing: 0.06,
      driftX: 0.07,
      driftY: 0.09,
      rotate: 18,
      driftPeriod: PERIODS[Math.floor(pick(seed, 50 + i) * PERIODS.length) % PERIODS.length],
      rotatePeriod: PERIODS[Math.floor(pick(seed, 60 + i) * PERIODS.length) % PERIODS.length],
      phase: pick(seed, 70 + i),
      mirrored: false,
    },
  }));
}

/** Où poser la pochette agrandie dans une tache de côté `side` pour que sa région soit au centre. */
export function blobImageFrame(side: number, focusX: number, focusY: number, zoom = BLOB_ZOOM): { x: number; y: number; size: number } {
  const size = side * zoom;
  return { x: side / 2 - focusX * size, y: side / 2 - focusY * size, size };
}
