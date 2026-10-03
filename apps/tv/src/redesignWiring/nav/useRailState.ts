import { useCallback, useEffect, useRef, useState } from "react";
import { useLibraries } from "@tentacle-tv/api-client";
import { railBlurDelay, railCollapseAfterBlur, railFocusedAfterFocus, railSelect, type RailSelect } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";
import { useRailPinning } from "../../components/nav/railPinning";
import { returnToSearchBar } from "../../components/search/searchBarReturn";
import { goToRailPage, railRouteOf } from "../../platform/tvos/back/railNavigate";
import type { RailArrange } from "./useRailArrange";

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

/** « Réglages de la navigation » (menu d'une entrée) : l'onglet Navigation des réglages. */
export function openNavigationSettings(): void {
  goToRailPage({ name: "Settings", params: { tab: "navigation" } });
}

export interface RailActions {
  onSelect: (key: string) => void;
  onLongPress: (key: string) => void;
}

export interface RailActionHooks {
  /** Choisir l'entrée de la page où l'on est ; défaut : `focusContent`. */
  onReselect?: () => void;
  /** Rendre le focus au contenu TOUT DE SUITE, dans le même geste, avant de quitter la page. */
  refocusContent?: () => void;
}

/**
 * OK et appui long sur une entrée du rail. La décision est dans tv-core
 * (`nav/railSelect`) ; on l'applique : poser l'entrée qu'on déplace, tout
 * afficher, revenir à la barre de recherche (`returnToSearchBar`, partagé avec
 * Android TV), rendre la page à son contenu (`onReselect`, sinon
 * `focusContent`), ou aller à une autre page (`goToRailPage`) — la page
 * d'arrivée prend son entrée, rail replié (`useEntryFocus`).
 */
export function useRailActions(
  railKey: string,
  focus: FocusStore,
  focusContent: () => void,
  arrange: Pick<RailArrange, "openMenu" | "dropIfMoving" | "isMoving">,
  hooks: RailActionHooks = {},
): RailActions {
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();
  const librariesRef = useRef(libraries);
  librariesRef.current = libraries;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const { openMenu, dropIfMoving, isMoving } = arrange;

  const onSelect = useCallback(
    (key: string) => {
      const libraryName = (libraryId: string) => librariesRef.current?.find((library: Library) => library.Id === libraryId)?.Name ?? "";
      const apply = (decision: RailSelect): void => {
        switch (decision.kind) {
          case "drop":
            dropIfMoving();
            return;
          case "showAll":
            pinning.showAll();
            focus.claim(decision.focus);
            return;
          case "searchBar":
            if (!returnToSearchBar()) apply(decision.otherwise);
            return;
          case "reselect":
            (hooksRef.current.onReselect ?? focusContent)();
            return;
          case "navigate":
            if (decision.refocusContentFirst) hooksRef.current.refocusContent?.();
            if (decision.to) goToRailPage(railRouteOf(decision.to, libraryName));
            return;
        }
      };
      apply(railSelect({ key, activeKey: railKey, moving: isMoving() }));
    },
    [focus, focusContent, pinning, railKey, dropIfMoving, isMoving],
  );

  return { onSelect, onLongPress: openMenu };
}
