import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FadingModal } from "../../redesign/motion/FadingModal";
import { NavEntryMenu, type NavMenuItem } from "../../redesign/nav/NavEntryMenu";
import { withMenuIntent } from "../../platform/tvos/input";
import type { FocusStore } from "../focus/focusStore";
import type { NavMenuAction, RailArrange } from "./useRailArrange";

/**
 * Le menu d'organisation d'une entrée, dans une `Modal` : sur tvOS elle a son
 * propre contrôleur, le focus n'en sort pas, et Retour la referme
 * (`onRequestClose`, par l'entrée unique : `withMenuIntent`) sans passer par
 * l'écran — le focus retrouve alors la case de l'entrée, ou celle qui l'a
 * remplacée (après « Masquer », la suivante : on enchaîne). tvOS y focalise
 * l'élément du haut : « Déplacer ». Refermé, le
 * menu s'efface d'un seul fondu avant que la Modal ne se retire
 * (`FadingModal`).
 *
 * Ses actions ignorent l'OK qui n'a pas commencé sur elles : le menu s'ouvre
 * sous l'appui long, encore enfoncé.
 */

const ACTIONS: readonly NavMenuAction[] = ["move", "up", "down", "hide", "showAll", "settings"];

export function NavMenuModal({ arrange, focus, railWidth }: { arrange: RailArrange; focus: FocusStore; railWidth?: number }) {
  const { t } = useTranslation("nav");
  const { menu, closeMenu, runMenuAction } = arrange;
  // Posé avant le premier rendu des actions : la garde est lue au rendu.
  useState(() => {
    for (const action of ACTIONS) focus.bind(`nav:menu:${action}`, { phantomPressGuard: true });
  });

  // Le dernier menu ouvert : ses lignes restent pendant qu'il s'efface.
  const lastMenu = useRef(menu);
  if (menu) lastMenu.current = menu;
  const shownMenu = lastMenu.current;
  const items = useMemo<NavMenuItem[]>(() => {
    if (!shownMenu) return [];
    return [
      { key: "move", label: t("railMenuMove"), icon: "moveVertical" },
      { key: "up", label: t("railMenuUp"), icon: "chevronUp", disabled: !shownMenu.canUp },
      { key: "down", label: t("railMenuDown"), icon: "chevronDown", disabled: !shownMenu.canDown },
      { key: "hide", label: t("railMenuHide"), icon: "eyeOff" },
      ...(shownMenu.canShowAll ? [{ key: "showAll", label: t("railShowAll"), icon: "eye" } as const] : []),
      { key: "settings", label: t("railMenuSettings"), icon: "panelLeft" },
    ];
  }, [shownMenu, t]);

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
