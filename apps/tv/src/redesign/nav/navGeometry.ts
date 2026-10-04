import { TV_STAGE } from "@tentacle-tv/theme";
import { railColumn, railContentHeight, type RailScrollGeometry } from "@tentacle-tv/tv-core";

/**
 * La géométrie de la navigation : DEUX capsules de verre qui ÉPOUSENT leur
 * contenu — le bloc des PAGES (Rechercher, puis la liste qui défile) et, en
 * bas, le bloc du PROFIL (le compte et ses réglages ; au-dessus, l'élément
 * des demandes en cours quand il existe).
 *
 * - Le bloc des pages est haut comme ses entrées et CENTRÉ sur la hauteur de
 *   l'écran. Avec beaucoup d'entrées, il ne dépasse jamais la taille du rail
 *   d'avant (`MAX_PANEL`) : sa liste défile.
 * - Le bloc du profil reste ancré en bas, jamais caché ni poussé hors de
 *   l'écran : c'est le bloc des pages qui lui cède la place (il remonte, puis
 *   défile) — `railColumn`, tv-core. Sur une Apple TV passée aux profils
 *   (Famille), « Changer de profil » s'y pose, juste au-dessus du profil.
 * - Replié : une bande d'icônes (`COLLAPSED_WIDTH`). Ouvert : la largeur de
 *   l'intitulé le plus long (mesurée, `navExpandedWidth`), bornée.
 *
 * Le moteur de focus calcule sa géométrie sur ces positions : rien ne bouge
 * sous lui quand la barre s'ouvre — seule la largeur des entrées change. La
 * légende du rail ouvert est une bulle à droite, hors de la colonne
 * (`NavLegend`) : elle ne réserve aucune place.
 *
 * Exportée pour l'intégration : les ponts et les raccourcis du rail se posent
 * sur ces bords (`NavRailGeometry`, que la vue publie).
 */

const N = TV_STAGE.nav;
const SCREEN_HEIGHT = 1080;

/** Le bord gauche des capsules : la colonne des pictogrammes reste à x = 88. */
export const RAIL_LEFT = N.left;
export const COLLAPSED_WIDTH = N.collapsedWidth;
/** Des pilules : rayon de la demi-largeur repliée. */
export const RADIUS = N.radius;
export const ITEM = N.itemHeight;
/** L'écart entre deux entrées, et le pas d'une entrée à la suivante. */
export const ITEM_GAP = 8;
export const PITCH = ITEM + ITEM_GAP;
/** La marge d'une entrée dans sa capsule — sur les côtés comme en haut et en bas. */
export const ITEM_INSET = (COLLAPSED_WIDTH - ITEM) / 2;

/** En tête du bloc des pages : Rechercher, puis le filet, à égale distance des deux entrées. */
export const SEARCH_TOP = ITEM_INSET;
export const SEPARATOR_TOP = SEARCH_TOP + ITEM + 12;
/** La marge intérieure de la liste (le fondu, l'entrée agrandie au focus). */
const LIST_PAD = 8;
export const LIST_TOP = SEPARATOR_TOP + 1 + 12 - LIST_PAD;
/** Ce qui, dans le bloc des pages, n'est pas la liste. */
const STRIP_CHROME = LIST_TOP + ITEM_INSET;

/** Le bloc du profil : ses marges, l'écart avec l'élément du dessus et sa
 *  hauteur permise — assez basse pour que le bloc des pages garde toujours
 *  plusieurs entrées visibles (650 points de liste au pire). */
export const BOTTOM_PAD = ITEM_INSET;
export const ACCESSORY_GAP = 8;
export const ACCESSORY_MAX = 240;

const MARGIN_TOP = N.top;
/** La marge basse : le bas du bloc du profil, et celui de la légende. */
export const MARGIN_BOTTOM = N.bottom;
/** Entre le bloc des pages et le bloc du profil. */
const CAPSULE_GAP = 14;
/** La hauteur du rail d'avant (1080 − 40 − 40 − 96 − 14) : jamais dépassée. */
export const MAX_PANEL = 890;

/** Du pictogramme au libellé ; du libellé au bord de l'entrée focalisée. */
export const LABEL_GAP = 4;
const LABEL_TAIL = 20;
/** Entre l'entrée et le bord droit de la capsule ; plus large quand la liste défile (son indicateur). */
const GUTTER = ITEM_INSET;
const SCROLL_GUTTER = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** La liste, pour une hauteur visible : l'entrée focalisée reste à `comfort` des bords. */
export function listGeometry(viewport: number): RailScrollGeometry {
  // 180 : la marge que tvOS tient LUI-MÊME quand le focus natif fait défiler
  // la liste (mesurée au simulateur, au pavé, dans les deux sens) — les
  // défilements que la vue décide tombent là où tvOS les aurait posés.
  return { viewport, item: ITEM, pitch: PITCH, padTop: LIST_PAD, padBottom: LIST_PAD, comfort: 180 };
}

/** Sur quelle hauteur une entrée s'estompe en approchant d'un bord qui cache la suite. */
export const FADE_DISTANCE = 104;

/** L'indicateur de position : une piste fine au bord droit, replié comme déplié. */
export const INDICATOR = { width: 4, insetCollapsed: 4, insetExpanded: 8, marginY: 10 } as const;

/** La hauteur du bloc des pages pour `count` entrées dans la liste, sans borne. */
export function stripHeight(count: number): number {
  return STRIP_CHROME + railContentHeight(count, listGeometry(0));
}

export interface NavLayoutInput {
  /** Les entrées de la liste (Rechercher à part). */
  count: number;
  /** La hauteur de l'élément posé au-dessus du profil ; 0 sans lui. */
  accessoryHeight?: number;
  /** « Changer de profil » (Famille), une entrée juste au-dessus du profil. */
  switcher?: boolean;
}

export interface NavLayout {
  /** Le bloc des pages : son haut, sa hauteur (repliée comme ouverte). */
  strip: { top: number; height: number };
  /** La hauteur visible de la liste. */
  viewport: number;
  /** Le bloc du profil : son haut, sa hauteur. */
  bottom: { top: number; height: number };
  /** L'élément au-dessus du profil (repère du bloc du profil), et le profil. */
  accessory: { top: number; height: number } | null;
  /** « Changer de profil », s'il existe (repère du bloc du profil). */
  switcherTop: number | null;
  profileTop: number;
}

/**
 * Où va chaque bloc. Le bloc du profil d'abord, ancré en bas ; puis le bloc
 * des pages, centré sur l'écran tant qu'il garde l'écart avec le profil —
 * sinon remonté, et au besoin réduit (sa liste défile). Jamais plus haut que
 * le rail d'avant.
 */
export function navLayout({ count, accessoryHeight = 0, switcher = false }: NavLayoutInput): NavLayout {
  const accessory = clamp(accessoryHeight, 0, ACCESSORY_MAX);
  const above = accessory > 0 ? accessory + ACCESSORY_GAP : 0;
  const switcherRow = switcher ? PITCH : 0;
  const bottomHeight = BOTTOM_PAD * 2 + above + switcherRow + ITEM;
  const { top, height, bottomTop } = railColumn({
    screen: SCREEN_HEIGHT,
    marginTop: MARGIN_TOP,
    marginBottom: MARGIN_BOTTOM,
    gap: CAPSULE_GAP,
    wanted: stripHeight(count),
    max: MAX_PANEL,
    bottom: bottomHeight,
  });
  return {
    strip: { top, height },
    viewport: height - STRIP_CHROME,
    bottom: { top: bottomTop, height: bottomHeight },
    accessory: accessory > 0 ? { top: BOTTOM_PAD, height: accessory } : null,
    switcherTop: switcher ? BOTTOM_PAD + above : null,
    profileTop: BOTTOM_PAD + above + switcherRow,
  };
}

/** Le centre vertical (écran) de l'entrée `index` de la liste, liste en haut : ôter son défilement. */
export function listEntryCenter(layout: NavLayout, index: number): number {
  return layout.strip.top + LIST_TOP + LIST_PAD + index * PITCH + ITEM / 2;
}

/** Le centre du profil, à l'écran (le bloc du bas ne défile pas). */
export function profileCenter(layout: NavLayout): number {
  return layout.bottom.top + layout.profileTop + ITEM / 2;
}

/** Les largeurs naturelles des textes du rail, mesurées (points). */
export interface NavTextWidths {
  /** Le plus long libellé d'entrée (gras, celui du focus), nom du compte compris. */
  label: number;
  /** La seconde ligne du profil. */
  caption: number;
}

/** Les bornes de la largeur ouverte. */
export const MIN_EXPANDED_WIDTH = N.minExpandedWidth;
export const MAX_EXPANDED_WIDTH = N.expandedWidth;

/** La marge droite d'une entrée ouverte : l'indicateur s'y loge quand la liste défile. */
export function gutterOf(scrolls: boolean): number {
  return scrolls ? SCROLL_GUTTER : GUTTER;
}

/**
 * La largeur du rail ouvert : celle de son intitulé le plus long — libellés,
 * nom et seconde ligne du profil —, bornée. Tant que rien n'est mesuré, la
 * plus grande : un libellé n'est jamais rogné d'avance.
 */
export function navExpandedWidth(widths: NavTextWidths | null, scrolls: boolean): number {
  if (!widths) return MAX_EXPANDED_WIDTH;
  const entry = ITEM_INSET + ITEM + LABEL_GAP + Math.max(widths.label, widths.caption) + LABEL_TAIL + gutterOf(scrolls);
  return clamp(Math.ceil(entry), MIN_EXPANDED_WIDTH, MAX_EXPANDED_WIDTH);
}

/** La largeur d'une entrée dans le rail ouvert. */
export function expandedItemWidth(expandedWidth: number, scrolls: boolean): number {
  return expandedWidth - ITEM_INSET - gutterOf(scrolls);
}

/**
 * Ce que la vue publie à l'intégration (`onGeometry`) : où sont les blocs, et
 * la largeur du rail ouvert — les guides de focus se posent sur ces bords.
 */
export interface NavRailGeometry {
  left: number;
  collapsedWidth: number;
  expandedWidth: number;
  strip: { top: number; bottom: number };
  profile: { top: number; bottom: number };
}

export function railGeometryOf(layout: NavLayout, expandedWidth: number): NavRailGeometry {
  return {
    left: RAIL_LEFT,
    collapsedWidth: COLLAPSED_WIDTH,
    expandedWidth,
    strip: { top: layout.strip.top, bottom: layout.strip.top + layout.strip.height },
    profile: { top: layout.bottom.top, bottom: layout.bottom.top + layout.bottom.height },
  };
}

/** Deux géométries identiques : l'intégration ne se redessine pas pour rien. */
export function sameRailGeometry(a: NavRailGeometry | null, b: NavRailGeometry): boolean {
  return (
    !!a &&
    a.left === b.left &&
    a.collapsedWidth === b.collapsedWidth &&
    a.expandedWidth === b.expandedWidth &&
    a.strip.top === b.strip.top &&
    a.strip.bottom === b.strip.bottom &&
    a.profile.top === b.profile.top &&
    a.profile.bottom === b.profile.bottom
  );
}
