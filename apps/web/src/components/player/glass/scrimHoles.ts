/**
 * Les TROUS du voile du lecteur (`GlassScrim`) — règle pure, sans DOM.
 *
 * Le verre natif vit SOUS la vue web : un voile noir peint par la page qui
 * passerait sur une forme de verre l'assombrirait d'autant — c'est le « gris
 * plat » que Damien a refusé (lot lg8). Le voile est donc PERCÉ exactement là où
 * une forme de verre se trouve : dans le trou, le verre voit la vidéo seule.
 */

export interface ScrimRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrimHole extends ScrimRect {
  /** Rayon des coins, borné à la demi-plus-petite dimension (une capsule, un cercle). */
  radius: number;
}

export interface ScrimShape extends ScrimRect {
  /** Le rayon CSS de la forme (`border-radius`, px de mise en page). */
  radius: number;
  /** Échelle affichée sur la mise en page (forme repliée, en train de naître). */
  scale: number;
}

/**
 * Les trous d'un voile posé en `scrim` (coordonnées de la fenêtre), pour des
 * formes données dans les mêmes coordonnées : ramenés dans le repère du voile,
 * arrondis au demi-pixel. Une forme qui ne touche pas le voile, ou qui n'a plus
 * de surface (repliée à l'échelle 0), ne perce rien.
 */
export function scrimHoles(scrim: ScrimRect, shapes: readonly ScrimShape[]): ScrimHole[] {
  const holes: ScrimHole[] = [];
  for (const shape of shapes) {
    if (shape.width < 0.5 || shape.height < 0.5) continue;
    const touches = shape.x < scrim.x + scrim.width && shape.x + shape.width > scrim.x
      && shape.y < scrim.y + scrim.height && shape.y + shape.height > scrim.y;
    if (!touches) continue;
    const radius = Math.min(shape.radius * shape.scale, shape.width / 2, shape.height / 2);
    holes.push({
      x: half(shape.x - scrim.x),
      y: half(shape.y - scrim.y),
      width: half(shape.width),
      height: half(shape.height),
      radius: half(Math.max(0, radius)),
    });
  }
  return holes;
}

/** Deux listes de trous identiques ? (évite un rendu par image quand rien ne bouge) */
export function sameHoles(a: readonly ScrimHole[], b: readonly ScrimHole[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((hole, i) => {
    const other = b[i]!;
    return hole.x === other.x && hole.y === other.y && hole.width === other.width
      && hole.height === other.height && hole.radius === other.radius;
  });
}

const half = (value: number): number => Math.round(value * 2) / 2;
