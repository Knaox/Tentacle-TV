import { useCallback, useMemo, useRef, useState } from "react";
import { railEntryTarget, railExpanded } from "@tentacle-tv/tv-core";
import type { NavRailProps } from "../../redesign/nav/NavRail";
import { sameRailGeometry, type NavRailGeometry } from "../../redesign/nav/navGeometry";
import { useFocusStore, type FocusStore } from "../../platform/tvos/focus/focusStore";
import { useLibraryPrefetch } from "../library/useLibraryPrefetch";
import { useNavEntries } from "../nav/useNavEntries";
import { useRailHints } from "../nav/useRailHints";
import { useRailArrange, type RailArrange } from "../nav/useRailArrange";
import { openNavigationSettings, useRailActions, useRailFocused } from "../nav/useRailState";
import { useRequestsAccessory } from "../vigie/RequestsEntry";
import { useEntryFocus } from "../../platform/tvos/focus/useEntryFocus";
import { useRowRewind, type RowRewindHandle } from "../../platform/tvos/focus/useRowRewind";

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
  /** Choisir l'entrée de la page où l'on est ; défaut : rendre le focus au contenu. */
  onReselect?: () => void;
  /** Le magasin de focus de l'écran, quand l'écran en a besoin AVANT ce hook
   *  (sinon il en crée un). */
  focus?: FocusStore;
  /** Ses rangées reviennent au début (l'accueil, « Pour vous » : tv-core
   *  `focus/rowRewind.ts`) — sorties de l'écran, au changement de page par le
   *  rail, et Retour vers la première carte. */
  rewindRows?: boolean;
  /** Au RETOUR sur l'écran (la pile redescend), la clé à viser à la place de
   *  la dernière de contenu — les réglages, au retour du pavé de son code PIN. */
  onReturn?: (contentKey: string | null) => string | null;
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
  /** L'organisation de la navigation : menu d'appui long, déplacement. */
  arrange: RailArrange;
  /** Où sont les capsules de la navigation et quelle largeur elle prend
   *  ouverte (publié par la vue) : les ponts et les raccourcis s'y posent.
   *  `null` tant que la vue ne l'a pas publiée. */
  railGeometry: NavRailGeometry | null;
  /** Les rangées qui reviennent au début, ou null : l'écran n'en a pas. */
  rows: RowRewindHandle | null;
}

export function useRedesignScreen({
  railKey,
  entryKey = null,
  onReselect,
  focus: given,
  rewindRows = false,
  onReturn,
}: RedesignScreenOptions): RedesignScreenModel {
  const own = useFocusStore();
  const focus = given ?? own;
  const arrange = useRailArrange(focus, openNavigationSettings);
  const entries = useNavEntries({ previewOrder: arrange.previewOrder, moving: arrange.movingKey !== null });
  const railFocused = useRailFocused(focus);
  // Les rangées lisent la clé de contenu, qui vient après elles.
  const remembered = useRef<() => string | null>(() => null);
  const rows = useRowRewind(focus, { enabled: rewindRows, remembered: () => remembered.current() });
  const { contentKey, railHeld } = useEntryFocus(focus, entryKey, onReturn ?? rows?.resume);
  remembered.current = contentKey;
  // Une bibliothèque focalisée dans la navigation : sa grille se prépare.
  useLibraryPrefetch(focus);

  const focusContent = useCallback(() => {
    const key = contentKey();
    if (key) focus.claim(key);
  }, [focus, contentKey]);

  const focusRail = useCallback(() => {
    focus.claim(railEntryTarget(railKey, (key) => focus.node(key) !== null));
  }, [focus, railKey]);

  // Quitter l'accueil par le rail (la règle : tv-core `railSelect`) : son
  // instance reste montée sous la page choisie, et UIKit lui rendra le focus
  // qu'elle avait en partant — une entrée du rail, qui rouvrait le rail au
  // retour sur l'accueil, sur l'ancienne page. Le focus repasse donc d'abord
  // dans son contenu, DANS le même geste (`focusNow`) : UIKit retient le
  // contenu. Sur une carte, le DÉBUT de sa rangée : on change de page, la
  // rangée revient au début (`useRowRewind`).
  const refocusContent = useCallback(() => {
    const key = contentKey();
    if (key) focus.focusNow(rows ? rows.startOf(key) : key);
  }, [focus, contentKey, rows]);

  const { onSelect, onLongPress } = useRailActions(railKey, focus, focusContent, arrange, { onReselect, refocusContent });

  // La géométrie que la vue publie : elle bouge avec les bibliothèques, la
  // langue (la largeur suit les libellés) et l'élément au-dessus du profil.
  const [railGeometry, setRailGeometry] = useState<NavRailGeometry | null>(null);
  const onGeometry = useCallback(
    (next: NavRailGeometry) => setRailGeometry((previous) => (sameRailGeometry(previous, next) ? previous : next)),
    [],
  );

  // Le menu d'une entrée ou un déplacement gardent la navigation ouverte.
  const { heldKey, movingKey } = arrange;
  // Un focus que la plateforme pose dans la navigation à l'arrivée ne l'ouvre pas (`railHeld`).
  const railOpen = railFocused && !railHeld;
  const expanded = railExpanded({ railFocused: railOpen, heldKey, movingKey });
  // Les demandes en cours (Vigie), dans le bloc du profil — ou rien.
  const accessory = useRequestsAccessory(focus, movingKey !== null);
  // Les astuces du rail ouvert — « Maintenir OK : organiser », « ◀ Réglages » —, tout de suite (tv-core `railHint`).
  const railHints = useRailHints(focus, { railFocused: railOpen, moving: movingKey !== null, menuOpen: heldKey !== null });
  const { organize: organizeHint, settings: settingsHint } = railHints;
  const nav = useMemo<NavRailProps>(
    () => ({ ...entries, accessory, organizeHint, settingsHint, activeKey: railKey, expanded, heldKey, movingKey, onSelect, onLongPress, onGeometry }),
    [entries, accessory, organizeHint, settingsHint, railKey, expanded, heldKey, movingKey, onSelect, onLongPress, onGeometry],
  );

  return { nav, focus, railKey, railFocused, focusContent, focusRail, contentKey, arrange, railGeometry, rows };
}
