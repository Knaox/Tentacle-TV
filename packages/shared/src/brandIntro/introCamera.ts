/**
 * La caméra de l'ouverture — pure, portée du site (`introCamera.js`).
 *
 * Deux repères : celui du logo (240 × 240 unités) et les points de l'écran.
 * `zoom` = points par unité du logo ; `offsetX/Y` = où se trouve le CENTRE DE
 * L'ÉCRAN du poulpe par rapport au centre de la fenêtre, en points.
 *
 * La plongée s'arrête quand la fenêtre ALLUMÉE (`lit` : l'intérieur du cadre
 * sur la TV) recouvre toute la fenêtre,
 * coins arrondis compris : à cet instant précis, la page qu'il montre est à
 * l'échelle 1 et à sa place.
 */
import { clamp, introEasing, progressOf, smoothstep } from "./easing";
import type { IntroGeometry, IntroRoundedRect } from "./introGeometry";
import { INTRO_TIMING } from "./introTimeline";

export interface IntroCamera {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface IntroCameraPlan {
  from: IntroCamera;
  to: IntroCamera;
}

/** Plus petit zoom auquel l'intérieur d'un écran recouvre une fenêtre vw × vh (marge de 3 %). */
export function coverZoom(vw: number, vh: number, inner: IntroRoundedRect, margin = 1.03): number {
  const halfWidth = inner.width / 2;
  const halfHeight = inner.height / 2;
  const radius = inner.rx;

  // Le coin de la fenêtre (le point le plus exigeant) tombe-t-il dans l'écran ?
  const covers = (zoom: number) => {
    const x = vw / 2 / zoom;
    const y = vh / 2 / zoom;
    if (x > halfWidth || y > halfHeight) return false;
    const dx = x - (halfWidth - radius);
    const dy = y - (halfHeight - radius);
    return dx <= 0 || dy <= 0 || dx * dx + dy * dy <= radius * radius;
  };

  let low = 0.001;
  let high = 10000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (covers(mid)) high = mid;
    else low = mid;
  }
  return high * margin;
}

/** Ce que l'encoche, la Dynamic Island, la barre d'accueil prennent sur chaque bord (points). */
export interface IntroSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: IntroSafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Le cadrage de départ et d'arrivée pour une fenêtre vw × vh : le logo entier,
 * centré sur son encombrement DANS LA ZONE SÛRE (220 à 420 points de haut,
 * jamais sous l'encoche ni la Dynamic Island), puis l'écran qui recouvre la
 * fenêtre ENTIÈRE — l'app y gère elle-même sa zone sûre.
 */
export function introCameraPlan(vw: number, vh: number, geometry: IntroGeometry, safe: IntroSafeInsets = NO_INSETS): IntroCameraPlan {
  const safeWidth = vw - safe.left - safe.right;
  const safeHeight = vh - safe.top - safe.bottom;
  const fromZoom = clamp(Math.min(safeWidth * 0.78, safeHeight * 0.5), 220, 420) / geometry.logo.units;
  const { target, logo } = geometry;
  const shiftX = (safe.left - safe.right) / 2;
  const shiftY = (safe.top - safe.bottom) / 2;
  return {
    from: {
      zoom: fromZoom,
      offsetX: (target.x - logo.center.x) * fromZoom + shiftX,
      offsetY: (target.y - logo.center.y) * fromZoom + shiftY,
    },
    to: { zoom: coverZoom(vw, vh, geometry.lit), offsetX: 0, offsetY: 0 },
  };
}

/**
 * La caméra à l'avancement `eased` (déjà passé par sa courbe) : zoom
 * géométrique — la vitesse perçue reste constante sur un rapport ×8 — et écran
 * ramené au centre de la fenêtre EN POINTS, sans jamais s'en écarter d'abord.
 */
export function cameraAt(eased: number, from: IntroCamera, to: IntroCamera): IntroCamera {
  const zoom = from.zoom * (to.zoom / from.zoom) ** eased;
  const rest = 1 - smoothstep(clamp(eased));
  return { zoom, offsetX: from.offsetX * rest, offsetY: from.offsetY * rest };
}

/** L'avancement de la plongée à l'instant t, passé par sa courbe. */
export const zoomEasedAt = (t: number): number => introEasing("zoom")(progressOf(t, INTRO_TIMING.zoom));

/** La caméra à l'instant t de la chorégraphie. */
export const cameraAtTime = (t: number, plan: IntroCameraPlan): IntroCamera => cameraAt(zoomEasedAt(t), plan.from, plan.to);
