/**
 * Les BANDES d'un matériau épais (menu, feuille) : un ton par rangée.
 *
 * Un menu couvre souvent deux mondes — la bande claire de la page en haut, le
 * héros sombre dessous. Un seul ton pour la surface (sa médiane) laisse une
 * partie illisible : du blanc sur le clair. Apple ne fait pas basculer un
 * grand verre d'un bloc (ce serait distrayant), mais ne laisse jamais un
 * libellé sans contraste ; ici, sans voile sombre (refonte du 22/10), chaque
 * RANGÉE prend le ton de SON dessous (`data-lg-band`, `liquidGlassSurface.css`).
 *
 * Un ton ne suffit pas toujours : sur un dessous de luminance MOYENNE (un
 * héros sombre remonté par le verre clair du thème clair), ni le blanc ni le
 * sombre ne tiennent 4,5:1 (plafond ~4,1:1 vers 0,2). Là, et là seulement, la
 * bande reçoit un VOILE MINIMAL dans le sens de son ton — blanc sous un texte
 * sombre, noir sous un texte clair —, juste ce qu'il faut pour que le texte le
 * plus faible de la bande (secondaire, danger) tienne l'AA : au plus ~0,3, au
 * milieu exact ; rien sur un dessous franc (`bandLook`). Le ton choisi est
 * celui qui demande le MOINS de voile.
 *
 * Ce module ne fait que DÉCIDER, sans DOM : quelles bandes (le parcours est
 * injecté — on descend dans la surface jusqu'aux éléments assez bas pour être
 * une rangée, `BAND_MAX_HEIGHT`, ou qui portent eux-mêmes du texte ; un verre
 * dans le verre a son propre ton : on n'y entre pas), quel ton, quel voile, et
 * le dégradé qui les porte (`bandVeilGradient`).
 */

import type { BackdropTone } from "./backdropTone";

/** Une rangée de menu, un en-tête avec photo : au-delà, on descend dedans. */
export const BAND_MAX_HEIGHT = 72;
/** Par surface : au-delà, le reste garde le ton de la surface. */
export const BAND_MAX_COUNT = 24;

export interface BandWalk<T> {
  children(node: T): readonly T[];
  /** Hauteur affichée ; 0 pour un élément sans boîte (`display: contents`, caché). */
  height(node: T): number;
  /** Du texte à lui, hors de ses enfants : il ne se découpe pas plus fin. */
  hasOwnText(node: T): boolean;
  /** À laisser : un verre qui a son propre ton, un calque décoratif. */
  skip(node: T): boolean;
}

/** Les bandes de `root`, dans l'ordre du document, sans chevauchement. */
export function collectBands<T>(root: T, walk: BandWalk<T>, max: number = BAND_MAX_COUNT): T[] {
  const bands: T[] = [];
  const visit = (node: T): void => {
    for (const child of walk.children(node)) {
      if (bands.length >= max) return;
      if (walk.skip(child)) continue;
      const kids = walk.children(child);
      const height = walk.height(child);
      if (height <= 0) {
        if (kids.length > 0) visit(child);
        continue;
      }
      if (kids.length === 0 || walk.hasOwnText(child) || height <= BAND_MAX_HEIGHT) {
        bands.push(child);
      } else {
        visit(child);
      }
    }
  };
  visit(root);
  return bands;
}

export interface BandRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ce qu'on mesure d'une bande : sa part VISIBLE dans la surface (un menu qui
 * défile cache ses rangées hors cadre) et dans la fenêtre ; `null` sinon.
 */
export function visibleBandRect(band: BandRect, surface: BandRect, viewport: { width: number; height: number }): BandRect | null {
  const left = Math.max(band.x, surface.x, 0);
  const top = Math.max(band.y, surface.y, 0);
  const right = Math.min(band.x + band.width, surface.x + surface.width, viewport.width);
  const bottom = Math.min(band.y + band.height, surface.y + surface.height, viewport.height);
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/* ── Ton et voile d'une bande ─────────────────────────────────────────────
 * En niveau de gris sRGB (0..1), celui du mélange des couleurs CSS. Les
 * cibles font tenir 4,5:1 au texte le PLUS FAIBLE d'une bande de matériau
 * épais (les jetons `--lg-*`) : sur fond sombre, le danger (#FFB4AB) ; sur
 * fond clair, le danger (#6E0B10) et le secondaire épais (0,74) — avec une
 * marge (~4,7:1 à la cible) : la mesure est une médiane sur toute la rangée,
 * le fond sous un mot peut être un peu plus défavorable. */

/** Ton sombre : le fond ne dépasse pas ce gris (luminance ~0,078). */
export const BAND_DARK_TARGET = 0.31;
/** Ton clair : le fond atteint au moins ce gris (luminance ~0,35). */
export const BAND_LIGHT_TARGET = 0.63;
/**
 * Les deux tons se valent à ce voile près : on garde celui de la bande, ou,
 * pour une bande neuve, celui de la SURFACE — des rangées voisines sur un même
 * dessous moyen ne s'alternent pas clair, sombre, clair.
 */
export const BAND_SWITCH_MARGIN = 0.06;
/** Un voile qui bouge de moins que ce pas ne se réécrit pas. */
export const BAND_VEIL_STEP = 0.02;

export interface BandLook {
  tone: BackdropTone;
  /** Opacité du voile : blanc sous le ton clair, noir sous le ton sombre. */
  veil: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const toGray = (luminance: number): number =>
  luminance <= 0.0031308 ? 12.92 * luminance : 1.055 * luminance ** (1 / 2.4) - 0.055;

/**
 * Le ton et le voile d'une bande, d'après les luminances mesurées sous ses
 * SEGMENTS (ses deux moitiés : un mot à gauche, un autre à droite, sur un
 * dessous qui change en chemin) — le voile vaut pour le segment le plus
 * exigeant. La mesure voit NOTRE voile (la capture est celle de la page) : on
 * le retire avant de décider, sinon le voile s'effacerait de lui-même à la
 * mesure suivante, et reviendrait à celle d'après. `surfaceTone` départage une
 * bande neuve quand les deux tons se valent.
 */
export function bandLook(previous: BandLook | null, luminances: readonly number[], surfaceTone: BackdropTone): BandLook {
  const veil = previous?.veil ?? 0;
  const need: Record<BackdropTone, number> = { dark: 0, light: 0 };
  for (const luminance of luminances) {
    const measured = toGray(clamp01(luminance));
    const base = clamp01(
      veil <= 0 || previous === null
        ? measured
        : previous.tone === "dark"
          ? measured / (1 - veil)
          : (measured - veil) / (1 - veil),
    );
    need.dark = Math.max(need.dark, base <= BAND_DARK_TARGET ? 0 : 1 - BAND_DARK_TARGET / base);
    need.light = Math.max(need.light, base >= BAND_LIGHT_TARGET ? 0 : (BAND_LIGHT_TARGET - base) / (1 - base));
  }
  const best: BackdropTone = need.dark <= need.light ? "dark" : "light";
  const other: BackdropTone = best === "dark" ? "light" : "dark";
  const tone = need[other] - need[best] < BAND_SWITCH_MARGIN ? (previous?.tone ?? surfaceTone) : best;
  const next = Math.round(need[tone] * 100) / 100;
  if (previous !== null && previous.tone === tone && Math.abs(previous.veil - next) < BAND_VEIL_STEP) {
    return previous;
  }
  return { tone, veil: next };
}

/** Part de la hauteur d'une bande, en haut et en bas, où son voile rejoint celui des voisines. */
const BAND_VEIL_EASE = 0.2;

/**
 * Le voile de la surface : un dégradé vertical, TENU sur le cœur de chaque
 * bande (là où est son texte), qui ne passe d'une bande à l'autre que dans
 * leurs bords et l'écart entre elles — jamais deux voiles mêlés sous un mot,
 * jamais un liseré entre deux rangées. `null` : aucun voile. `top`, `bottom`
 * en px depuis le haut de la surface.
 */
export function bandVeilGradient(bands: ReadonlyArray<{ top: number; bottom: number; look: BandLook }>): string | null {
  if (!bands.some((b) => b.look.veil > 0)) return null;
  const color = ({ tone, veil }: BandLook): string =>
    `rgba(var(--lg-${tone === "dark" ? "shade" : "light"}-rgb), ${veil})`;
  const parts = [...bands]
    .sort((a, b) => a.top - b.top)
    .flatMap(({ top, bottom, look }) => {
      const ease = (bottom - top) * BAND_VEIL_EASE;
      return [`${color(look)} ${Math.round(top + ease)}px`, `${color(look)} ${Math.round(bottom - ease)}px`];
    });
  return `linear-gradient(to bottom, ${parts.join(", ")})`;
}
