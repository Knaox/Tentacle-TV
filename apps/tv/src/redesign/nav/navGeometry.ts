import { TV_STAGE } from "@tentacle-tv/theme";
import type { RailScrollGeometry } from "@tentacle-tv/tv-core";

/**
 * La géométrie de la navigation : DEUX capsules de verre, même largeur, un
 * petit écart — le rail principal en haut (Rechercher, puis la liste qui
 * défile), la capsule du profil en bas, fixe.
 *
 * Tout est constant, replié comme déplié : le moteur de focus calcule sa
 * géométrie sur ces positions, et rien ne doit bouger sous lui quand la barre
 * s'ouvre (la leçon de l'ancien rail, `railSpec.ts`). La légende du bas garde
 * donc sa place même repliée, où elle ne montre rien.
 *
 * Exportée pour l'intégration : les ponts de focus du rail (au-dessus, à
 * gauche, au-dessous) se posent sur ces bords.
 */

const N = TV_STAGE.nav;

/** L'écart entre deux entrées, et le pas d'une entrée à la suivante. */
export const ITEM_GAP = 8;
export const PITCH = N.itemHeight + ITEM_GAP;

/** À gauche d'une entrée, dans sa capsule (repliée : l'entrée carrée y est centrée). */
export const ITEM_LEFT = (N.collapsedWidth - N.itemHeight) / 2;
/** Une entrée dépliée : la barre, moins ses marges et la piste de l'indicateur. */
export const EXPANDED_ITEM = N.expandedWidth - ITEM_LEFT - 24;

/** La capsule du profil : une entrée et sa marge. */
export const PROFILE_PAD = 16;
export const PROFILE_HEIGHT = N.itemHeight + PROFILE_PAD * 2;
/** L'écart entre les deux capsules. */
export const CAPSULE_GAP = 14;

/** Le rail principal : de son haut à la capsule du profil. */
export const RAIL_TOP = N.top;
export const RAIL_HEIGHT = 1080 - N.top - N.bottom - PROFILE_HEIGHT - CAPSULE_GAP;
export const PROFILE_TOP = RAIL_TOP + RAIL_HEIGHT + CAPSULE_GAP;

/** En tête du rail : Rechercher, puis le filet. */
export const SEARCH_TOP = 22;
export const SEPARATOR_TOP = SEARCH_TOP + N.itemHeight + 12;
/** La liste qui défile : sous le filet, jusqu'à la légende. */
export const LIST_TOP = SEPARATOR_TOP + 1 + 12;
/** La légende du rail déplié : deux lignes courtes. */
export const LEGEND_HEIGHT = 76;
const BOTTOM_PAD = 18;
export const LIST_HEIGHT = RAIL_HEIGHT - LIST_TOP - LEGEND_HEIGHT - BOTTOM_PAD;
export const LEGEND_TOP = LIST_TOP + LIST_HEIGHT;

/**
 * La liste : l'entrée focalisée reste à `comfort` des bords
 * (`railRevealOffset`). C'est la marge que tvOS tient LUI-MÊME quand le focus
 * natif fait défiler la liste — mesurée au simulateur tvOS 26.2, au pavé,
 * dans les deux sens : 180 points, deux entrées et demie visibles au-delà.
 * Les défilements que la vue décide (repliée, menu ouvert, focus figé du
 * banc) tombent ainsi là où tvOS les aurait posés.
 */
export const LIST_GEOMETRY: RailScrollGeometry = {
  viewport: LIST_HEIGHT,
  item: N.itemHeight,
  pitch: PITCH,
  padTop: 8,
  padBottom: 8,
  comfort: 180,
};

/** Sur quelle hauteur une entrée s'estompe en approchant d'un bord qui cache la suite. */
export const FADE_DISTANCE = 104;

/** L'indicateur de position : une piste fine, au bord droit de la capsule. */
export const INDICATOR = { width: 4, inset: 10, marginY: 10 } as const;
