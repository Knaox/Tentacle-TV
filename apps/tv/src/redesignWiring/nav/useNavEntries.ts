import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RAIL_HOME_KEY, RAIL_PROFILE_KEY, RAIL_SEARCH_KEY, RAIL_SHOW_ALL_KEY, applyRailOrder } from "@tentacle-tv/tv-core";
import type { NavEntry, NavHint, NavRailProps } from "../../redesign/nav/NavRail";
import { usePairedAccount } from "../../hooks/usePairedAccount";
import { useNavCatalog } from "./useNavCatalog";
import { useProfileSwitcher } from "./useProfileSwitcher";
import { remoteHint } from "../../platform/input";

/**
 * Ce que la navigation refondue propose, dans l'ordre où on la parcourt, sur
 * le magasin d'épinglage partagé avec la LG : Rechercher à part, en tête ;
 * Accueil ; puis les entrées ORGANISABLES dans l'ordre choisi, masquées
 * retirées (`useNavCatalog`) ; « Tout afficher » dès qu'une entrée est
 * masquée ; et la capsule du profil — l'engrenage, le nom du compte,
 * « Profil et réglages » dessous ; au-dessus, sur une Apple TV passée aux
 * profils (Famille), « Changer de profil » (`useProfileSwitcher` : la photo
 * du profil connecté et « +N »).
 *
 * Aucune légende permanente : pendant un déplacement seulement, ses touches
 * (`previewOrder` est alors l'ordre en cours, que rien n'a encore
 * enregistré). « Maintenir OK : organiser » et « ◀ Réglages » se disent à
 * côté de ce qu'ils concernent, au focus (`useRailHints`).
 */

/** « Tout afficher » : tv-core (`nav/railKeys`). */
export const SHOW_ALL_KEY = RAIL_SHOW_ALL_KEY;

export type NavEntries = Pick<NavRailProps, "search" | "entries" | "account" | "switcher" | "hints">;

export interface NavEntriesOptions {
  previewOrder?: readonly string[] | null;
  moving?: boolean;
}

export function useNavEntries({ previewOrder = null, moving = false }: NavEntriesOptions = {}): NavEntries {
  const { t } = useTranslation(["nav"]);
  const catalog = useNavCatalog();
  const switcher = useProfileSwitcher();
  // Le nom seul : l'entrée des réglages porte l'engrenage, la photo du profil
  // est sur « Changer de profil ».
  const userName = usePairedAccount().name ?? "";

  const hints = useMemo<NavHint[]>(
    () =>
      moving
        ? [
            { icon: "moveVertical", label: t(remoteHint("railMove")) },
            { icon: "circleDot", label: t(remoteHint("railDrop")) },
          ]
        : [],
    [t, moving],
  );

  return useMemo(() => {
    const movable = previewOrder ? applyRailOrder(catalog.entries, previewOrder, (entry) => entry.key) : catalog.entries;
    const entries: NavEntry[] = [{ key: RAIL_HOME_KEY, label: t("home"), icon: "home" }];
    for (const entry of movable) if (!entry.hidden) entries.push({ key: entry.key, label: entry.label, icon: entry.icon });
    if (catalog.entries.some((entry) => entry.hidden)) entries.push({ key: SHOW_ALL_KEY, label: t("railShowAll"), icon: "eye" });
    return {
      search: { key: RAIL_SEARCH_KEY, label: t("search"), icon: "search" },
      entries,
      account: {
        key: RAIL_PROFILE_KEY,
        // Le nom du compte, et ce qu'on trouve derrière ; sans nom, les réglages.
        label: userName || t("preferences"),
        caption: userName ? t("railProfile") : undefined,
        icon: "settings",
      },
      switcher,
      hints,
    };
  }, [t, catalog, previewOrder, userName, switcher, hints]);
}
