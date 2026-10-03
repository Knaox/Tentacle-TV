import { RAIL_PROFILE_KEY, RAIL_SEARCH_KEY, isNavKey, navKeyOf } from "./railKeys";

/**
 * Les RACCOURCIS et les PONTS du rail — où mène une flèche au bord du rail
 * ou du contenu. Module pur : la géométrie arrive en argument (points) ;
 * l'adaptateur pose des guides de focus invisibles sur ces zones.
 *
 * Les ponts (jamais montés ensemble) — le moteur de focus ne vise qu'une cible
 * ALIGNÉE, or les entrées du rail sont peu nombreuses :
 * - contenu focalisé : une bande à gauche du contenu, toute la hauteur, mène
 *   à l'entrée ACTIVE du rail (sinon Accueil) ;
 * - rail focalisé : la zone à droite du rail OUVERT rend le focus à la
 *   dernière cible de contenu (sinon l'entrée de l'écran).
 *
 * Les raccourcis, rail focalisé, hors menu et déplacement :
 * - HAUT depuis Rechercher → le profil (la navigation boucle) ;
 * - BAS depuis le profil → Rechercher ;
 * - GAUCHE depuis toute entrée → le profil, une fois ARMÉ : 450 ms après
 *   l'arrivée dans le rail, 1 100 ms si l'on y est arrivé en rafale (le contenu
 *   avait le focus il y a moins de 350 ms : flèche maintenue — la Siri Remote
 *   n'émet pas la fin d'un appui maintenu). Mesuré : la répétition déplace le
 *   focus toutes les 150 à 250 ms ; GAUCHE maintenu 1,2 s et 2 s depuis une
 *   rangée s'arrête sur l'entrée de la page.
 */

export const RAIL_LEFT_ARM_MS = 450;
export const RAIL_LEFT_ARM_AFTER_STREAM_MS = 1100;
/** Une arrivée dans le rail moins longtemps que ça après un focus de contenu vient d'une flèche maintenue. */
export const RAIL_STREAM_MS = 350;

/** Les cibles des trois raccourcis (clés de focus). */
export const RAIL_SHORTCUT_TARGETS = {
  above: navKeyOf(RAIL_PROFILE_KEY),
  below: navKeyOf(RAIL_SEARCH_KEY),
  left: navKeyOf(RAIL_PROFILE_KEY),
} as const;

/** Les raccourcis existent : le focus est dans le rail, ni menu d'une entrée, ni déplacement. */
export function railShortcutsActive(state: { railFocused: boolean; heldKey: string | null; movingKey: string | null }): boolean {
  return state.railFocused && state.heldKey === null && state.movingKey === null;
}

/** Un focus qui date l'arrivée en rafale : un focus de CONTENU. */
export function marksContentFocus(focusKey: string): boolean {
  return !isNavKey(focusKey);
}

/** Le délai d'armement de GAUCHE → profil, à l'arrivée dans le rail. */
export function railLeftArmDelay(lastContentFocusAt: number, now: number): number {
  return now - lastContentFocusAt < RAIL_STREAM_MS ? RAIL_LEFT_ARM_AFTER_STREAM_MS : RAIL_LEFT_ARM_MS;
}

/** La géométrie que la vue du rail publie. */
export interface RailFrame {
  left: number;
  expandedWidth: number;
  strip: { top: number; bottom: number };
  profile: { top: number; bottom: number };
}

/** Une zone en points, posée en absolu (`bottom` : distance au bas de l'écran). */
export interface RailZone {
  left: number;
  top: number;
  width?: number;
  height?: number;
  bottom?: number;
  right?: number;
}

/** Les zones des raccourcis : au-dessus du bloc des pages, sous le profil, à gauche des capsules. */
export function railShortcutZones(frame: RailFrame): Record<"above" | "below" | "left", RailZone> {
  const { left, expandedWidth, strip, profile } = frame;
  return {
    above: { left, width: expandedWidth, top: 0, height: Math.max(0, strip.top - 4) },
    below: { left, width: expandedWidth, top: profile.bottom + 4, bottom: 0 },
    left: { left: 0, width: left - 4, top: 0, bottom: 0 },
  };
}

/** Entre le bord droit du rail ouvert et le pont de sortie. */
export const RAIL_EXIT_BRIDGE_GAP = 12;
/** Le pont d'entrée s'arrête à cette distance du bord gauche du contenu. */
export const RAIL_ENTER_BRIDGE_INSET = 20;

export type RailBridge =
  /** Rail focalisé : vers la dernière cible de contenu (ou rien). */
  | { kind: "exit"; target: string | null; zone: RailZone }
  /** Contenu focalisé : vers l'entrée active, sinon Accueil (`railEntryTarget`). */
  | { kind: "enter"; zone: RailZone };

/**
 * Le pont du moment. `frame` : la géométrie publiée (null tant qu'elle ne
 * l'est pas : la plus grande largeur ouverte) ; `contentLeft` : le bord du
 * contenu de l'écran.
 */
export function railBridge(state: {
  railFocused: boolean;
  contentKey: string | null;
  frame: Pick<RailFrame, "left" | "expandedWidth"> | null;
  defaults: { left: number; expandedWidth: number };
  contentLeft: number;
}): RailBridge {
  if (state.railFocused) {
    const left = (state.frame?.left ?? state.defaults.left) + (state.frame?.expandedWidth ?? state.defaults.expandedWidth) + RAIL_EXIT_BRIDGE_GAP;
    return { kind: "exit", target: state.contentKey, zone: { left, right: 0, top: 0, bottom: 0 } };
  }
  return { kind: "enter", zone: { left: 0, top: 0, bottom: 0, width: state.contentLeft - RAIL_ENTER_BRIDGE_INSET } };
}
