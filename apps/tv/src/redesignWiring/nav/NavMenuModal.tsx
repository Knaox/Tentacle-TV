import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NAV_MENU_PREFIX, RAIL_MENU_ACTIONS, railMenuItems, type RailMenuAction } from "@tentacle-tv/tv-core";
import type { IconName } from "../../redesign/icons/Icon";
import { FadingModal } from "../../redesign/motion/FadingModal";
import { NavEntryMenu, type NavMenuItem } from "../../redesign/nav/NavEntryMenu";
import { withMenuIntent } from "../../platform/tvos/input";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import type { NavMenuAction, RailArrange } from "./useRailArrange";

/**
 * Le menu d'organisation d'une entrée, dans une `Modal` : sur tvOS elle a son
 * propre contrôleur, le focus n'en sort pas, et Retour la referme
 * (`onRequestClose`, par l'entrée unique : `withMenuIntent`) sans passer par
 * l'écran — le focus retrouve alors la case de l'entrée, ou celle qui l'a
 * remplacée (après « Masquer », la suivante : on enchaîne). tvOS y focalise
 * l'élément du haut : « Déplacer ». Refermé, le menu s'efface d'un seul
 * fondu avant que la Modal ne se retire (`FadingModal`).
 *
 * Ses actions ignorent l'OK qui n'a pas commencé sur elles : le menu s'ouvre
 * sous l'appui long, encore enfoncé.
 */

/** Ce que dit et montre chaque ligne ; l'ordre, les lignes et leur état : tv-core (`railMenuItems`). */
const LINES: Record<RailMenuAction, { label: string; icon: IconName }> = {
  move: { label: "railMenuMove", icon: "moveVertical" },
  up: { label: "railMenuUp", icon: "chevronUp" },
  down: { label: "railMenuDown", icon: "chevronDown" },
  hide: { label: "railMenuHide", icon: "eyeOff" },
  showAll: { label: "railShowAll", icon: "eye" },
  settings: { label: "railMenuSettings", icon: "panelLeft" },
};

export function NavMenuModal({ arrange, focus, railWidth }: { arrange: RailArrange; focus: FocusStore; railWidth?: number }) {
  const { t } = useTranslation("nav");
  const { menu, closeMenu, runMenuAction } = arrange;
  // Posé avant le premier rendu des actions : la garde est lue au rendu.
  useState(() => {
    for (const action of RAIL_MENU_ACTIONS) focus.bind(`${NAV_MENU_PREFIX}${action}`, { phantomPressGuard: true });
  });

  // Le dernier menu ouvert : ses lignes restent pendant qu'il s'efface.
  const lastMenu = useRef(menu);
  if (menu) lastMenu.current = menu;
  const shownMenu = lastMenu.current;
  const items = useMemo<NavMenuItem[]>(
    () =>
      shownMenu
        ? railMenuItems(shownMenu).map(({ action, ...state }) => ({ key: action, label: t(LINES[action].label), icon: LINES[action].icon, ...state }))
        : [],
    [shownMenu, t],
  );

  return (
    <FadingModal value={menu} onRequestClose={withMenuIntent(closeMenu)}>
      {(shown, leaving) => (
        <NavEntryMenu
          title={shown.label}
          caption={t("railMenuPosition", { position: shown.position, count: shown.count })}
          items={items}
          railWidth={railWidth}
          onPress={leaving ? undefined : (key) => runMenuAction(key as NavMenuAction)}
        />
      )}
    </FadingModal>
  );
}
