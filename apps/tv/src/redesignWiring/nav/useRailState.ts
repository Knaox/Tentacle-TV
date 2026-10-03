import { useCallback, useEffect, useRef, useState } from "react";
import { useLibraries } from "@tentacle-tv/api-client";
import { navKeyOf, railBlurDelay, railCollapseAfterBlur, railFocusedAfterFocus } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";
import { useRailPinning } from "../../components/nav/railPinning";
import { returnToSearchBar } from "../../components/search/searchBarReturn";
import { railNavigate } from "../../navigation/railNavigate";
import type { RailArrange } from "./useRailArrange";
import { SHOW_ALL_KEY } from "./useNavEntries";

/**
 * L'état de la navigation refondue d'un écran : ouverte quand l'une de ses
 * entrées a le focus, repliée quand le focus se pose ailleurs DANS l'écran ;
 * ce que font l'appui et l'appui long (le menu d'organisation,
 * `useRailArrange`).
 *
 * La clé de focus d'une entrée est `nav:<clé>` (`NavItem`). Passer d'une
 * entrée à l'autre ne replie pas la barre : le repli attend un court instant
 * que le focus se soit posé ailleurs. Parti HORS de l'écran — dans une Modal
 * ouverte depuis la navigation : la vue des demandes, le menu d'une entrée —,
 * il la laisse ouverte dessous : repliée sous la Modal, elle se redépliait à
 * sa fermeture, quand le focus revenait à l'entrée (filmé : la barre repliée
 * quatre images, puis dépliée).
 */

/** Les clés du rail : tv-core (`nav/railKeys`), réexportées pour les importateurs d'ici. */
export { NAV_PREFIX, isNavKey, navKeyOf } from "@tentacle-tv/tv-core";

/** Vrai quand le focus est dans la navigation — la règle : tv-core `nav/railFocus`. */
export function useRailFocused(focus: FocusStore): boolean {
  const [railFocused, setRailFocused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = focus.subscribe((key, focused) => {
      if (focused) {
        if (timer) clearTimeout(timer);
        timer = null;
        setRailFocused(railFocusedAfterFocus(key));
        return;
      }
      const delay = railBlurDelay(key);
      if (delay === null) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (railCollapseAfterBlur(focus.focusedKey())) setRailFocused(false);
      }, delay);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [focus]);
  return railFocused;
}

type Library = { Id: string; Name: string };

/** À la manière d'onglets : la pile ne grossit pas d'un passage à l'autre (`railNavigate`). */
function navigateTo(key: string, libraries: readonly Library[] | undefined): void {
  switch (key) {
    case "Home":
    case "Search":
    case "Recommendations":
    case "Watchlist":
    case "Favorites":
    case "Settings":
      railNavigate(key);
      return;
  }
  if (key.startsWith("Library_")) {
    const libraryId = key.slice("Library_".length);
    const libraryName = libraries?.find((library) => library.Id === libraryId)?.Name ?? "";
    railNavigate("Library", { libraryId, libraryName });
  }
}

/** « Réglages de la navigation » (menu d'une entrée) : l'onglet Navigation des réglages. */
export function openNavigationSettings(): void {
  railNavigate("Settings", { tab: "navigation" });
}

export interface RailActions {
  onSelect: (key: string) => void;
  onLongPress: (key: string) => void;
}

export interface RailActionHooks {
  /** Choisir l'entrée de la page où l'on est ; défaut : `focusContent`. */
  onReselect?: () => void;
  /** Juste avant de naviguer vers une autre page, dans le même geste. */
  beforeLeave?: () => void;
}

/**
 * `focusContent` rend le focus au contenu (choisir l'entrée de la page où
 * l'on est) ; `onReselect` le remplace quand l'écran veut autre chose.
 * Pendant un déplacement, OK pose l'entrée (`arrange`). Choisir une autre
 * page y mène ; la page d'arrivée prend le focus dans son contenu, rail
 * replié (`useEntryFocus`).
 */
export function useRailActions(
  railKey: string,
  focus: FocusStore,
  focusContent: () => void,
  arrange: Pick<RailArrange, "openMenu" | "dropIfMoving">,
  hooks: RailActionHooks = {},
): RailActions {
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const { openMenu, dropIfMoving } = arrange;

  const onSelect = useCallback(
    (key: string) => {
      if (dropIfMoving()) return;
      if (key === SHOW_ALL_KEY) {
        // L'entrée choisie disparaît avec ce qu'elle rend : le focus va à l'entrée active.
        pinning.showAll();
        focus.claim(navKeyOf(railKey));
        return;
      }
      if (key === "Search" && returnToSearchBar()) return;
      if (key === railKey) {
        (hooksRef.current.onReselect ?? focusContent)();
        return;
      }
      hooksRef.current.beforeLeave?.();
      navigateTo(key, librariesRef.current);
    },
    [focus, focusContent, pinning, railKey, dropIfMoving],
  );

  return { onSelect, onLongPress: openMenu };
}
