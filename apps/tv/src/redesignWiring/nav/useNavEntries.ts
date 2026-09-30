import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { applyRailOrder } from "@tentacle-tv/tv-core";
import type { NavEntry, NavHint, NavRailProps } from "../../redesign/nav/NavRail";
import { usePairedAccount } from "../../hooks/usePairedAccount";
import { useVerifiedImage } from "../../hooks/useVerifiedImage";
import { useNavCatalog } from "./useNavCatalog";

/**
 * Ce que la navigation refondue propose, dans l'ordre où on la parcourt, sur
 * le magasin d'épinglage partagé avec la LG : Rechercher à part, en tête ;
 * Accueil ; puis les entrées ORGANISABLES dans l'ordre choisi, masquées
 * retirées (`useNavCatalog`) ; « Tout afficher » dès qu'une entrée est
 * masquée ; et la capsule du profil — le nom du compte, « Profil et
 * réglages » dessous.
 *
 * Pendant un déplacement, `previewOrder` est l'ordre en cours, que rien n'a
 * encore enregistré ; la légende dit alors les touches du déplacement.
 */

export const SHOW_ALL_KEY = "RailShowAll";

/** Le diamètre du portrait dans la navigation (`NavItem`), en points. */
const AVATAR = 46;

export type NavEntries = Pick<NavRailProps, "search" | "entries" | "account" | "hints">;

export interface NavEntriesOptions {
  previewOrder?: readonly string[] | null;
  moving?: boolean;
}

export function useNavEntries({ previewOrder = null, moving = false }: NavEntriesOptions = {}): NavEntries {
  const { t } = useTranslation("nav");
  const catalog = useNavCatalog();
  // Le portrait des réglages, par la même adresse : `Users/{id}/Images/Primary`
  // passe le proxy du serveur, `GET /Users/{id}` non (hors de sa liste
  // blanche : la navigation retombait toujours sur l'initiale). Montré
  // seulement s'il existe — sinon un rond vide, là où l'initiale se lit.
  const paired = usePairedAccount(AVATAR);
  const avatarUri = useVerifiedImage(paired.portraitUrl);
  const userName = paired.name ?? "";

  const hints = useMemo<NavHint[]>(
    () =>
      moving
        ? [
            { icon: "moveVertical", label: t("railHintMove") },
            { icon: "circleDot", label: t("railHintDrop") },
          ]
        : [
            { icon: "chevronLeft", label: t("railProfile") },
            { icon: "circleDot", label: t("railHintOrganize") },
          ],
    [t, moving],
  );

  return useMemo(() => {
    const movable = previewOrder ? applyRailOrder(catalog.entries, previewOrder, (entry) => entry.key) : catalog.entries;
    const entries: NavEntry[] = [{ key: "Home", label: t("home"), icon: "home" }];
    for (const entry of movable) if (!entry.hidden) entries.push({ key: entry.key, label: entry.label, icon: entry.icon });
    if (catalog.entries.some((entry) => entry.hidden)) entries.push({ key: SHOW_ALL_KEY, label: t("railShowAll"), icon: "eye" });
    return {
      search: { key: "Search", label: t("search"), icon: "search" },
      entries,
      account: {
        key: "Settings",
        // Le nom du compte, et ce qu'on trouve derrière ; sans nom, les réglages.
        label: userName || t("preferences"),
        caption: userName ? t("railProfile") : undefined,
        avatarUri,
        initial: userName ? userName.charAt(0).toUpperCase() : undefined,
      },
      hints,
    };
  }, [t, catalog, previewOrder, avatarUri, userName, hints]);
}
