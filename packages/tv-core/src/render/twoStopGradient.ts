/**
 * Un dégradé à DEUX arrêts (profil Lite, `gradients: "twoStop"`) qui garde
 * l'allure de l'original : le même départ, la même arrivée, et sa variation
 * au même endroit — la rampe linéaire passe la MOITIÉ du chemin là où
 * l'original la passe, et va de 10 % à 90 % sur la même longueur que lui. Un voile [0,9 → 0,62 → 0,05 → 0] reste sombre à gauche
 * et clair à droite, sans tomber au milieu.
 *
 * La « distance » d'un arrêt est sa distance au premier, en RGBA (0 à 1 par
 * canal), rapportée à celle du dernier. Un dégradé qui revient à sa couleur
 * de départ, ou une couleur illisible (un nombre, un nom) : l'original, tel quel.
 */

/** Une couleur écrite (chaîne) ; un nombre (couleur déjà convertie) n'est pas lu. */
export type GradientColor = string | number;

export interface GradientStops<C extends GradientColor = GradientColor> {
  colors: readonly C[];
  locations?: readonly number[];
}

type Rgba = [number, number, number, number];

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(…)`, `rgba(…)` → RGBA de 0 à 1 ; sinon `null`. */
export function parseGradientColor(color: GradientColor): Rgba | null {
  if (typeof color !== "string") return null;
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    const byte = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return [byte(0), byte(2), byte(4), h.length === 8 ? byte(6) : 1];
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (!fn) return null;
  return [Number(fn[1]) / 255, Number(fn[2]) / 255, Number(fn[3]) / 255, fn[4] === undefined ? 1 : Number(fn[4])];
}

const distance = (a: Rgba, b: Rgba) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);

/** Où (de 0 à 1) le dégradé atteint `fraction` de son chemin pour la première fois. */
function crossing(progress: readonly number[], locations: readonly number[], fraction: number): number {
  for (let i = 1; i < progress.length; i++) {
    const [p0, p1] = [progress[i - 1], progress[i]];
    if (p1 >= fraction && p0 < fraction) {
      return locations[i - 1] + ((fraction - p0) / (p1 - p0)) * (locations[i] - locations[i - 1]);
    }
  }
  return locations[locations.length - 1];
}

export function twoStopGradient<C extends GradientColor>({ colors, locations }: GradientStops<C>): GradientStops<C> {
  if (colors.length <= 2) return { colors, locations };
  const parsed = colors.map(parseGradientColor);
  if (parsed.some((c) => c === null)) return { colors, locations };
  const rgba = parsed as Rgba[];
  const total = distance(rgba[0], rgba[rgba.length - 1]);
  if (total < 1e-6) return { colors, locations };
  const at = locations && locations.length === colors.length ? locations : colors.map((_, i) => i / (colors.length - 1));
  const progress = rgba.map((c) => Math.min(1, distance(c, rgba[0]) / total));
  const t10 = crossing(progress, at, 0.1);
  const t90 = crossing(progress, at, 0.9);
  const t50 = crossing(progress, at, 0.5);
  const span = Math.max((t90 - t10) / 0.8, 1e-3);
  const start = Math.max(0, t50 - 0.5 * span);
  const end = Math.min(1, Math.max(start + 1e-3, start + span));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { colors: [colors[0], colors[colors.length - 1]], locations: [round(start), round(end)] };
}
