/**
 * La caméra de l'ouverture — pure, portée du site (`introCamera.js`).
 *
 * Deux repères : celui du logo (240 × 240 unités) et les points de l'écran.
 * `zoom` = points par unité du logo ; `offsetX/Y` = où se trouve le CENTRE DE
 * L'ÉCRAN du poulpe par rapport au centre de la fenêtre, en points.
 *
 * La plongée s'arrête quand l'INTÉRIEUR du cadre recouvre toute la fenêtre,
 * coins arrondis compris : à cet instant précis, la page qu'il montre est à
 * l'échelle 1 et à sa place.
 */
import { clamp, introEasing, progressOf, smoothstep } from "./easing";
import { LOGO_CENTER, LOGO_UNITS, type IntroGeometry, type IntroRoundedRect } from "./introGeometry";
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

/**
 * Le cadrage de départ et d'arrivée pour une fenêtre vw × vh : le logo entier,
 * centré sur son encombrement (220 à 420 points de haut), puis l'écran qui
 * recouvre la fenêtre.
 */
export function introCameraPlan(vw: number, vh: number, geometry: IntroGeometry): IntroCameraPlan {
  const fromZoom = clamp(Math.min(vw * 0.78, vh * 0.5), 220, 420) / LOGO_UNITS;
  const { target } = geometry;
  return {
    from: { zoom: fromZoom, offsetX: (target.x - LOGO_CENTER.x) * fromZoom, offsetY: (target.y - LOGO_CENTER.y) * fromZoom },
    to: { zoom: coverZoom(vw, vh, geometry.inner), offsetX: 0, offsetY: 0 },
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
