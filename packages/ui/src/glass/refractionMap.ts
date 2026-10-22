/**
 * Les CARTES d'une lentille de verre, calculées pour UNE surface (sa taille,
 * son rayon, son biseau) : la carte de déplacement (la réfraction) et la carte
 * spéculaire (la lumière que le bord attrape).
 *
 * POURQUOI PAR SURFACE. Le verre d'Apple ne courbe l'image que dans un BISEAU
 * qui suit le contour, coins compris ; le centre reste net. Une carte générique
 * étirée sur la boîte (l'ancien `GlassFilters`) réfractait 18 % de chaque
 * dimension et ignorait les coins. D'où une carte par géométrie, mise en cache.
 *
 * Déplacement (`feDisplacementMap`) : rouge = X, vert = Y, 128 = immobile ;
 * le profil vient de `lensProfile` (Snell, biseau squircle), vers l'intérieur.
 *
 * Spéculaire : blanc, l'alpha porte la lumière. Un liseré fin au ras du bord,
 * d'autant plus vif que le bord FAIT FACE à la lumière (en haut, et plus
 * doucement en vis-à-vis, en bas) — jamais un « border » gris uniforme — et
 * une lueur douce qui descend sous l'arête éclairée, dans le biseau.
 *
 * Pur (aucun DOM) : testé hors navigateur. La mise en image est à côté.
 */

import { lensProfile } from "./lensProfile";

export interface RefractionGeometry {
  /** Taille de la surface, en px CSS. */
  width: number;
  height: number;
  /** Rayon des coins, en px CSS (plafonné à la demi-plus-petite dimension). */
  radius: number;
  /** Largeur du biseau qui réfracte, en px CSS. */
  bezel: number;
  /**
   * Densité de l'écran (`devicePixelRatio`, 1 par défaut). Les cartes se
   * calculent à cette densité tant que la surface est petite : sans elle, le
   * liseré d'une pastille de 30 px s'empâte sur un écran Retina.
   */
  pixelRatio?: number;
}

/** La lumière du bord. Alphas de 0 à 1. */
export interface SpecularLight {
  /** Direction d'où vient la lumière, en degrés : 0 = du haut, positif = vers la droite. */
  angle: number;
  /** Liseré du bord qui fait face à la lumière. */
  facing: number;
  /** Liseré du bord opposé (le reflet en vis-à-vis). */
  opposite: number;
  /** Liseré minimal, tout autour. */
  base: number;
  /** Épaisseur du liseré, en px CSS. */
  rim: number;
  /** Lueur douce sous l'arête éclairée, dans le biseau. */
  glow: number;
}

export interface RefractionMap {
  /** Taille de la carte, en pixels (≤ la surface : voir `refractionMapScale`). */
  width: number;
  height: number;
  /** RGBA, ligne par ligne (tampon ordinaire : `ImageData` refuse un partagé). */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface LensMaps {
  displacement: RefractionMap;
  /** `null` sans lumière demandée. */
  specular: RefractionMap | null;
}

/** Au-delà de ce nombre de pixels, les cartes se calculent à résolution réduite. */
export const REFRACTION_MAP_MAX_PIXELS = 160_000;

const NEUTRAL = 128;

/**
 * Résolution des cartes, en pixels de carte par px CSS : la densité de
 * l'écran (2 au plus), réduite pour qu'une grande surface ne dépasse pas
 * `REFRACTION_MAP_MAX_PIXELS`.
 */
export function refractionMapScale(width: number, height: number, pixelRatio = 1): number {
  const density = Math.min(2, Math.max(1, pixelRatio));
  const pixels = width * height * density * density;
  if (pixels <= REFRACTION_MAP_MAX_PIXELS) return density;
  return density * Math.sqrt(REFRACTION_MAP_MAX_PIXELS / pixels);
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Calcule les cartes d'une surface (la spéculaire seulement si `light`). */
export function buildLensMaps(geometry: RefractionGeometry, light?: SpecularLight): LensMaps {
  const width = Math.max(1, geometry.width);
  const height = Math.max(1, geometry.height);
  const scale = refractionMapScale(width, height, geometry.pixelRatio);
  const mapWidth = Math.max(1, Math.round(width * scale));
  const mapHeight = Math.max(1, Math.round(height * scale));
  const displacement = new Uint8ClampedArray(mapWidth * mapHeight * 4);
  const specular = light ? new Uint8ClampedArray(mapWidth * mapHeight * 4) : null;

  const halfW = width / 2;
  const halfH = height / 2;
  const radius = Math.max(0, Math.min(geometry.radius, halfW, halfH));
  const bezel = Math.max(0.5, geometry.bezel);
  const innerW = halfW - radius;
  const innerH = halfH - radius;
  // Vers la lumière (repère écran : y vers le bas).
  const angle = ((light?.angle ?? 0) * Math.PI) / 180;
  const lightX = Math.sin(angle);
  const lightY = -Math.cos(angle);

  for (let py = 0; py < mapHeight; py++) {
    const y = ((py + 0.5) / mapHeight) * height;
    const dy = y - halfH;
    const qy = Math.abs(dy) - innerH;
    for (let px = 0; px < mapWidth; px++) {
      const x = ((px + 0.5) / mapWidth) * width;
      const dx = x - halfW;
      const qx = Math.abs(dx) - innerW;
      const offset = (py * mapWidth + px) * 4;
      displacement[offset] = NEUTRAL;
      displacement[offset + 1] = NEUTRAL;
      displacement[offset + 2] = NEUTRAL;
      displacement[offset + 3] = 255;

      // Distance signée au contour arrondi (négative dedans).
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const depth = -(outside + Math.min(Math.max(qx, qy), 0) - radius);
      if (depth <= 0) continue;

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

      if (depth < bezel) {
        // Le rayon se plie vers l'intérieur : on échantillonne CONTRE la normale.
        const magnitude = lensProfile(depth / bezel);
        displacement[offset] = Math.round(127.5 - 127.5 * nx * magnitude);
        displacement[offset + 1] = Math.round(127.5 - 127.5 * ny * magnitude);
      }

      if (specular !== null && light !== undefined) {
        const facing = nx * lightX + ny * lightY;
        const strength =
          facing >= 0
            ? light.base + (light.facing - light.base) * Math.pow(facing, 1.6)
            : light.base + (light.opposite - light.base) * Math.pow(-facing, 1.6);
        // Liseré net au ras du bord, adouci sur un demi-pixel vers l'intérieur.
        const rim = strength * (1 - smooth(light.rim * 0.5, light.rim + 0.5, depth));
        const glow =
          facing > 0 ? light.glow * Math.pow(facing, 2) * Math.pow(Math.max(0, 1 - depth / bezel), 2) : 0;
        const alpha = 1 - (1 - rim) * (1 - glow);
        specular[offset] = 255;
        specular[offset + 1] = 255;
        specular[offset + 2] = 255;
        specular[offset + 3] = Math.round(alpha * 255);
      }
    }
  }

  return {
    displacement: { width: mapWidth, height: mapHeight, data: displacement },
    specular: specular === null ? null : { width: mapWidth, height: mapHeight, data: specular },
  };
}

/** La seule carte de déplacement (compatibilité). */
export function buildRefractionMap(geometry: RefractionGeometry): RefractionMap {
  return buildLensMaps(geometry).displacement;
}

/** Clé de cache d'une géométrie (au px près : la carte est lisse). */
export function refractionMapKey(geometry: RefractionGeometry, light?: SpecularLight): string {
  const r = (value: number) => Math.round(value);
  const base = `${r(geometry.width)}x${r(geometry.height)}-r${r(geometry.radius)}-b${r(geometry.bezel)}-d${geometry.pixelRatio ?? 1}`;
  if (light === undefined) return base;
  const l = (value: number) => Math.round(value * 100);
  return `${base}-a${r(light.angle)}-f${l(light.facing)}-o${l(light.opposite)}-s${l(light.base)}-w${l(light.rim)}-g${l(light.glow)}`;
}
