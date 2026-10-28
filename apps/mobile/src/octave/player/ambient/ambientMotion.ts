/**
 * Octave (mobile) — les règles PURES du fond vivant du lecteur plein écran (`ambientMotion.test.ts`).
 *
 * Le fond, ce sont les COULEURS DE LA POCHETTE : la pochette elle-même, réduite (une vignette suffit) et
 * floutée une fois au décodage, posée en trois grands calques qui couvrent l'écran (jamais un bord visible,
 * même tournés) et dérivent lentement les uns sur les autres — les teintes se mélangent comme chez Apple
 * Music —, plus une touche du dégradé de la marque. Rien que des transformations : la couleur ne se calcule
 * jamais à chaque image.
 *
 * Une seule horloge (secondes, bouclée sur `AMBIENT_CYCLE_S`) ; chaque période DIVISE le cycle, donc le
 * retour à zéro ne se voit pas. Chaque titre tire sa propre disposition (`ambientLayers(seed)`).
 */

/** Le cycle de l'horloge (s) : toutes les périodes le divisent. */
export const AMBIENT_CYCLE_S = 240;
/** Les périodes possibles d'un mouvement (s), toutes diviseurs de 240 : lentes, jamais nerveuses. */
const PERIODS = [40, 48, 60, 80, 120] as const;
/** La vignette lue pour le fond (px) : le flou efface tout détail au-delà. */
export const AMBIENT_ARTWORK_SIZE = 160;
/** Le flou appliqué à la vignette (une fois, au décodage). */
export const AMBIENT_BLUR = 24;
/** Le fondu croisé d'un titre à l'autre (ms) : le temps d'une respiration. */
export const AMBIENT_CROSSFADE_MS = 900;

export interface AmbientLayer {
  /** Opacité du calque (le premier est plein : il couvre l'écran). */
  opacity: number;
  /** Échelle de repos et amplitude de sa respiration. */
  scale: number;
  scaleSwing: number;
  /** Dérive (part de la largeur / de la hauteur) et rotation maximale (degrés). */
  driftX: number;
  driftY: number;
  rotate: number;
  /** Périodes (s) de la dérive et de la rotation, phase de départ (0..1). */
  driftPeriod: number;
  rotatePeriod: number;
  phase: number;
  /** Retourné en miroir : les teintes de la pochette se rangent autrement. */
  mirrored: boolean;
}

export interface LayerTransform {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scale: number;
}

/** Une graine stable tirée de l'adresse de la pochette (FNV-1a) : le même titre, la même disposition. */
export function ambientSeed(key: string | null | undefined): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < (key ?? "").length; i++) {
    hash ^= (key ?? "").charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function pick(seed: number, salt: number): number {
  // Un tirage 0..1 déterministe par calque et par propriété.
  const x = Math.sin((seed % 100003) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function period(seed: number, salt: number): number {
  return PERIODS[Math.floor(pick(seed, salt) * PERIODS.length) % PERIODS.length];
}

/** Les trois calques de la pochette, du fond vers le dessus. */
export function ambientLayers(seed: number): AmbientLayer[] {
  const base = [
    { opacity: 1, scale: 1.05, scaleSwing: 0.06, driftX: 0.06, driftY: 0.05, rotate: 14, mirrored: false },
    { opacity: 0.6, scale: 1.25, scaleSwing: 0.1, driftX: 0.14, driftY: 0.1, rotate: -26, mirrored: true },
    { opacity: 0.42, scale: 1.4, scaleSwing: 0.12, driftX: 0.18, driftY: 0.16, rotate: 34, mirrored: false },
  ];
  return base.map((layer, i) => ({
    ...layer,
    driftPeriod: period(seed, i * 3 + 1),
    rotatePeriod: period(seed, i * 3 + 2),
    phase: pick(seed, i * 3 + 3),
  }));
}

/** La touche de la marque (violet → rose), discrète : elle colore sans masquer la pochette. */
export const AMBIENT_BRAND_TINT: AmbientLayer = {
  opacity: 0.2,
  scale: 1.3,
  scaleSwing: 0.08,
  driftX: 0.12,
  driftY: 0.14,
  rotate: 40,
  driftPeriod: 80,
  rotatePeriod: 120,
  phase: 0.37,
  mirrored: false,
};

/**
 * La transformation d'un calque à l'instant `seconds` de l'horloge, pour un écran `width` × `height`.
 * Fonction de travail (worklet) : elle tourne sur le fil d'interface, à chaque image.
 */
export function layerTransform(layer: AmbientLayer, seconds: number, width: number, height: number): LayerTransform {
  "worklet";
  const tau = Math.PI * 2;
  const d = (seconds / layer.driftPeriod + layer.phase) * tau;
  const r = (seconds / layer.rotatePeriod + layer.phase) * tau;
  return {
    // Une courbe de Lissajous (x deux fois plus lent que y) : une dérive qui ne repasse pas en ligne droite.
    translateX: Math.sin(d) * layer.driftX * width,
    translateY: Math.sin(d * 2 + 1.3) * layer.driftY * height * 0.5,
    rotateDeg: Math.sin(r) * layer.rotate,
    scale: layer.scale + Math.sin(r * 2 + 0.7) * layer.scaleSwing,
  };
}

/**
 * Le côté d'un calque (pt) : la diagonale de l'écran, marge comprise pour la dérive. Tourné de n'importe quel
 * angle et poussé de sa dérive maximale, il couvre encore tout l'écran.
 */
export function layerSide(width: number, height: number, layer: AmbientLayer): number {
  // Le pire cas : le coin de l'écran le plus loin du centre du calque, dérive maximale comprise.
  const reach = Math.hypot(width / 2 + layer.driftX * width, height / 2 + layer.driftY * height * 0.5);
  const minScale = layer.scale - layer.scaleSwing;
  return Math.ceil((2 * reach) / Math.max(0.5, minScale));
}

export interface AmbientRunInput {
  /** Le lecteur plein écran est ouvert (pas en train de se refermer). */
  open: boolean;
  /** L'app est au premier plan (ni arrière-plan, ni écran verrouillé). */
  appActive: boolean;
  /** La musique joue : en pause, le fond se fige avec elle. */
  playing: boolean;
  /** Mouvement réduit demandé par le système. */
  reduceMotion: boolean;
}

/** Le fond bouge-t-il ? Seulement affiché, au premier plan, en lecture, et sans mouvement réduit. */
export function ambientShouldRun(input: AmbientRunInput): boolean {
  return input.open && input.appActive && input.playing && !input.reduceMotion;
}

/** La vignette de la pochette pour le fond (`?size=` du serveur) ; une image d'un autre hôte ou de l'appareil, telle quelle. */
export function ambientArtworkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /[?&]size=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}size=${AMBIENT_ARTWORK_SIZE}`;
}
