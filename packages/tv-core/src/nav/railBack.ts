import { railBackStep } from "./backLayers";
import type { BackLayerSpec } from "./backResolve";
import { RAIL_HOME_KEY, RAIL_PROFILE_KEY, navKeyOf } from "./railKeys";

/**
 * Les couches du Retour d'un écran à RAIL, déclarées — module pur ; la portée
 * de la plateforme les inscrit (`useBackLayers`) dans cet ordre.
 *
 * Sur une page du rail, la règle de `railBackStep` :
 * - le focus dans la page : le rail s'ouvre, sur l'entrée de la page (couche
 *   « page ») ;
 * - le rail ouvert : le focus va sur le profil (couche « rail ») ;
 * - déjà sur le profil : aucune couche — la plateforme quitte.
 *
 * Une page POUSSÉE qui montre le rail (l'étagère d'une personne) n'en relève
 * pas : sans couche, elle recule, rail ouvert ou non.
 *
 * Et sur tout écran à rail, l'organisation : Retour annule un déplacement et
 * ferme le menu d'une entrée (couches « menu »).
 */

export type RailBackAction = "openRail" | "toProfile" | "cancelMove" | "closeMenu";

export interface RailBackState {
  /** L'écran est une page du rail (`isRailPage`). */
  railPage: boolean;
  /** Le focus est dans le rail. */
  railFocused: boolean;
  /** Le focus est sur le profil. */
  onProfile: boolean;
  moving: boolean;
  menuOpen: boolean;
}

export function railScreenBackLayers(state: RailBackState): BackLayerSpec<RailBackAction>[] {
  const step = railBackStep({ railFocused: state.railFocused, onSettings: state.onProfile });
  return [
    { id: "openRail", kind: "page", active: state.railPage && step === "openRail", action: "openRail" },
    { id: "toProfile", kind: "rail", active: state.railPage && step === "toSettings", action: "toProfile" },
    { id: "cancelMove", kind: "menu", active: state.moving, action: "cancelMove" },
    { id: "closeMenu", kind: "menu", active: state.menuOpen, action: "closeMenu" },
  ];
}

/** La clé de focus du profil : là où va le deuxième Retour d'une page du rail. */
export const RAIL_PROFILE_FOCUS_KEY = navKeyOf(RAIL_PROFILE_KEY);

/** Ouvrir le rail : sur l'entrée de la page, sinon — pas encore montée — sur Accueil. */
export function railEntryTarget(activeKey: string, isMounted: (focusKey: string) => boolean): string {
  const active = navKeyOf(activeKey);
  return isMounted(active) ? active : navKeyOf(RAIL_HOME_KEY);
}
