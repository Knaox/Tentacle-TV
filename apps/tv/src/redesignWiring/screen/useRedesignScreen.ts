import { useCallback, useMemo } from "react";
import type { NavRailProps } from "../../redesign/nav/NavRail";
import { useFocusStore, type FocusStore } from "../focus/focusStore";
import { useNavEntries } from "../nav/useNavEntries";
import { navKeyOf, useRailActions, useRailFocused } from "../nav/useRailState";
import { useEntryFocus } from "./useEntryFocus";

/**
 * Ce qu'un écran refondu AVEC navigation demande au socle — l'accueil, « Pour
 * vous », les bibliothèques, Ma liste, les favoris, la recherche, les
 * réglages. Il reçoit les props de sa `NavRail` et le magasin de focus de sa
 * vue, et confie le reste à `<RedesignScreen screen={…}>` :
 *
 *   const screen = useRedesignScreen({ railKey: "Home", entryKey: "hero:primary" });
 *   return (
 *     <RedesignScreen screen={screen}>
 *       <HomeView nav={screen.nav} … />
 *     </RedesignScreen>
 *   );
 *
 * Un écran SANS navigation (jumelage, fiche, lecteur) n'en a pas besoin :
 * `useFocusStore()` et `<FocusBindingProvider bind={store.binder}>` suffisent.
 */

export interface RedesignScreenOptions {
  /** L'entrée active de la navigation : "Home", "Recommendations",
   *  "Library_<id>", "Watchlist", "Favorites", "Search", "Settings". */
  railKey: string;
  /** La clé focalisée à l'arrivée — et au retour, faute de mieux. Réactive :
   *  elle suit l'état de l'écran (chargement, erreur, contenu). */
  entryKey?: string | null;
  /** Menu depuis le contenu : rend vrai s'il a été pris (un panneau à fermer).
   *  Sinon, Menu ouvre la navigation. */
  onBack?: () => boolean;
  /** Choisir l'entrée de la page où l'on est ; défaut : rendre le focus au contenu. */
  onReselect?: () => void;
  /** Le magasin de focus de l'écran, quand l'écran en a besoin AVANT ce hook
   *  (sinon il en crée un). */
  focus?: FocusStore;
}

export interface RedesignScreenModel {
  nav: NavRailProps;
  focus: FocusStore;
  railKey: string;
  /** Le focus est dans la navigation (elle est ouverte). */
  railFocused: boolean;
  /** Rend le focus au contenu : le dernier élément focalisé, sinon l'entrée. */
  focusContent: () => void;
  /** Ouvre la navigation, le focus sur l'entrée active. */
  focusRail: () => void;
  /** La clé de contenu que viserait `focusContent`. */
  contentKey: () => string | null;
  onBack?: () => boolean;
}

export function useRedesignScreen({ railKey, entryKey = null, onBack, onReselect, focus: given }: RedesignScreenOptions): RedesignScreenModel {
  const own = useFocusStore();
  const focus = given ?? own;
  const entries = useNavEntries();
  const railFocused = useRailFocused(focus);
  const { contentKey } = useEntryFocus(focus, entryKey);

  const focusContent = useCallback(() => {
    const key = contentKey();
    if (key) focus.claim(key);
  }, [focus, contentKey]);

  const focusRail = useCallback(() => {
    const active = navKeyOf(railKey);
    focus.claim(focus.node(active) ? active : navKeyOf("Home"));
  }, [focus, railKey]);

  const { onSelect, onLongPress } = useRailActions(railKey, focus, focusContent, onReselect);

  const nav = useMemo<NavRailProps>(
    () => ({ ...entries, activeKey: railKey, expanded: railFocused, onSelect, onLongPress }),
    [entries, railKey, railFocused, onSelect, onLongPress],
  );

  return { nav, focus, railKey, railFocused, focusContent, focusRail, contentKey, onBack };
}
