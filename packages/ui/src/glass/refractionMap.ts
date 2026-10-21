/**
 * Carte de déplacement d'une lentille de verre — le cœur de la réfraction
 * Chromium, calculée pour UNE surface (sa taille, son rayon, son biseau).
 *
 * POURQUOI PAR SURFACE. L'ancien filtre (`GlassFilters.tsx`) étirait une carte
 * fixe de 100 × 100 sur la boîte : la bande qui réfractait valait 18 % de la
 * dimension — 216 px sur une barre de 1 200 px, 12 px sur sa hauteur —, et
 * les coins arrondis n'y étaient pas. Le verre d'Apple ne courbe l'image que
 * dans un BISEAU de largeur constante qui suit le contour, coins compris ; le
 * centre reste net. D'où une carte par géométrie, mise en cache.
 *
 * Le modèle : une lentille plan-convexe posée sur la page. Son profil est une
 * « squircle » (h = (1 − (1 − t)⁴)^¼, t de 0 au bord à 1 en fin de biseau) :
 * raide au ras du bord, plate ensuite. Un rayon qui traverse une surface
 * inclinée se plie vers l'INTÉRIEUR : on voit, près du bord, ce qui est un
 * peu plus vers le centre — le grossissement caractéristique. Le décalage
 * suit la pente (saturée : s / (1 + s)), maximal au bord, nul au centre.
 *
 * Encodage, celui de `feDisplacementMap` : rouge = axe X, vert = axe Y,
 * 128 = aucun déplacement. Avec `scale = 2 × décalage max`, un octet de 255
 * déplace de +décalage max, un octet de 0 de −décalage max.
 *
 * Pur (aucun DOM) : testé hors navigateur. La mise en image est à côté
 * (`refractionMapUrl`).
 */

export interface RefractionGeometry {
  /** Taille de la surface, en px CSS. */
  width: number;
  height: number;
  /** Rayon des coins, en px CSS (plafonné à la demi-plus-petite dimension). */
  radius: number;
  /** Largeur du biseau qui réfracte, en px CSS. */
  bezel: number;
}

export interface RefractionMap {
  /** Taille de la carte, en pixels (≤ la surface : voir `resolution`). */
  width: number;
  height: number;
  /** RGBA, ligne par ligne (tampon ordinaire : `ImageData` refuse un partagé). */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** Au-delà de ce nombre de pixels, la carte se calcule à résolution réduite. */
export const REFRACTION_MAP_MAX_PIXELS = 160_000;

const NEUTRAL = 128;

/**
 * Intensité du déplacement à une profondeur `t` du biseau (0 au bord, 1 au
 * bout) : 1 au ras du bord, 0 au-delà du biseau, décroissante entre les deux.
 */
export function refractionProfile(t: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  const u = 1 - t;
  // Pente de la squircle h(t) = (1 − u⁴)^¼ : h'(t) = u³ / (1 − u⁴)^¾.
  const slope = (u * u * u) / Math.pow(1 - u * u * u * u, 0.75);
  return slope / (1 + slope);
}

/** Résolution de la carte : 1 pixel de carte par px CSS, sauf grande surface. */
export function refractionMapScale(width: number, height: number): number {
  const pixels = width * height;
  if (pixels <= REFRACTION_MAP_MAX_PIXELS) return 1;
  return Math.sqrt(REFRACTION_MAP_MAX_PIXELS / pixels);
}

/** Calcule la carte de déplacement d'une surface. */
export function buildRefractionMap(geometry: RefractionGeometry): RefractionMap {
  const width = Math.max(1, geometry.width);
  const height = Math.max(1, geometry.height);
  const scale = refractionMapScale(width, height);
  const mapWidth = Math.max(1, Math.round(width * scale));
  const mapHeight = Math.max(1, Math.round(height * scale));
  const data = new Uint8ClampedArray(mapWidth * mapHeight * 4);

  const halfW = width / 2;
  const halfH = height / 2;
  const radius = Math.max(0, Math.min(geometry.radius, halfW, halfH));
  const bezel = Math.max(0.5, geometry.bezel);
  // Le centre de la boîte « droite » : au-delà, on est dans un coin.
  const innerW = halfW - radius;
  const innerH = halfH - radius;

  for (let py = 0; py < mapHeight; py++) {
    const y = ((py + 0.5) / mapHeight) * height;
    const dy = y - halfH;
    const qy = Math.abs(dy) - innerH;
    for (let px = 0; px < mapWidth; px++) {
      const x = ((px + 0.5) / mapWidth) * width;
      const dx = x - halfW;
      const qx = Math.abs(dx) - innerW;
      const offset = (py * mapWidth + px) * 4;
      data[offset + 2] = NEUTRAL;
      data[offset + 3] = 255;

      // Distance signée au contour arrondi (négative dedans).
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const sdf = outside + Math.min(Math.max(qx, qy), 0) - radius;
      const depth = -sdf;
      if (depth <= 0 || depth >= bezel) {
        data[offset] = NEUTRAL;
        data[offset + 1] = NEUTRAL;
        continue;
      }

      // Normale sortante : vers le centre du coin dans un coin, l'axe dominant ailleurs.
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        nx = qx / len;
        ny = qy / len;
      } else if (qx > qy) {
        nx = 1;
        ny = 0;
      } else {
        nx = 0;
        ny = 1;
      }
      if (dx < 0) nx = -nx;
      if (dy < 0) ny = -ny;

      // Le rayon se plie vers l'intérieur : on échantillonne CONTRE la normale.
      const magnitude = refractionProfile(depth / bezel);
      data[offset] = Math.round(127.5 - 127.5 * nx * magnitude);
      data[offset + 1] = Math.round(127.5 - 127.5 * ny * magnitude);
    }
  }

  return { width: mapWidth, height: mapHeight, data };
}

/** Clé de cache d'une géométrie (au px près : la carte est lisse). */
export function refractionMapKey(geometry: RefractionGeometry): string {
  const r = (value: number) => Math.round(value);
  return `${r(geometry.width)}x${r(geometry.height)}-r${r(geometry.radius)}-b${r(geometry.bezel)}`;
}
