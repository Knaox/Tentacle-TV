import { useMemo, useState } from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { NavEntryMenu, type NavMenuItem } from "../../redesign/nav/NavEntryMenu";
import type { FocusStore } from "../focus/focusStore";
import type { NavMenuAction, RailArrange } from "./useRailArrange";

/**
 * Le menu d'organisation d'une entrée, dans une `Modal` : sur tvOS elle a son
 * propre contrôleur, le focus n'en sort pas, et Retour la referme
 * (`onRequestClose`) sans passer par l'écran — le focus retrouve alors la case
 * de l'entrée, ou celle qui l'a remplacée (après « Masquer », la suivante :
 * on enchaîne). tvOS y focalise l'élément du haut : « Déplacer ».
 *
 * Ses actions ignorent l'OK qui n'a pas commencé sur elles : le menu s'ouvre
 * sous l'appui long, encore enfoncé.
 */

const ACTIONS: readonly NavMenuAction[] = ["move", "up", "down", "hide", "showAll", "settings"];

export function NavMenuModal({ arrange, focus }: { arrange: RailArrange; focus: FocusStore }) {
  const { t } = useTranslation("nav");
  const { menu, closeMenu, runMenuAction } = arrange;
  // Posé avant le premier rendu des actions : la garde est lue au rendu.
  useState(() => {
    for (const action of ACTIONS) focus.bind(`nav:menu:${action}`, { phantomPressGuard: true });
  });

  const items = useMemo<NavMenuItem[]>(() => {
    if (!menu) return [];
    return [
      { key: "move", label: t("railMenuMove"), icon: "moveVertical" },
      { key: "up", label: t("railMenuUp"), icon: "chevronUp", disabled: !menu.canUp },
      { key: "down", label: t("railMenuDown"), icon: "chevronDown", disabled: !menu.canDown },
      { key: "hide", label: t("railMenuHide"), icon: "eyeOff" },
      ...(menu.canShowAll ? [{ key: "showAll", label: t("railShowAll"), icon: "eye" } as const] : []),
      { key: "settings", label: t("railMenuSettings"), icon: "panelLeft" },
    ];
  }, [menu, t]);

  return (
    <Modal visible={menu !== null} transparent animationType="none" onRequestClose={closeMenu}>
      {menu ? (
        <NavEntryMenu
          title={menu.label}
          caption={t("railMenuPosition", { position: menu.position, count: menu.count })}
          items={items}
          onPress={(key) => runMenuAction(key as NavMenuAction)}
        />
      ) : null}
    </Modal>
  );
}
