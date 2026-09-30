import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { applyRailOrder, sameRailOrder, type RailPinning } from "@tentacle-tv/tv-core";
import type { IconName } from "../../redesign/icons/Icon";
import type { NavEntry } from "../../redesign/nav/NavRail";
import { useRailPinning } from "../../components/nav/railPinning";

/**
 * Les entrées que l'on ORGANISE : Pour vous, Ma liste, Favoris et chaque
 * bibliothèque — dans l'ordre choisi (`applyRailOrder` sur le magasin
 * d'épinglage partagé avec la LG), masquées comprises. La navigation n'en
 * montre que les visibles ; le réglage « Navigation » les montre toutes.
 *
 * Rechercher, Accueil, « Tout afficher » et le profil n'en font pas partie :
 * ils ne se masquent ni ne se déplacent — la navigation ne doit jamais
 * devenir une impasse.
 */

const MOVABLE_FIXED = new Set(["Recommendations", "Watchlist", "Favorites"]);

/** Une entrée qu'on peut masquer et déplacer. */
export function isMovableEntry(key: string): boolean {
  return MOVABLE_FIXED.has(key) || key.startsWith("Library_");
}

export interface NavCatalogEntry extends NavEntry {
  hidden: boolean;
}

export interface NavCatalog {
  /** Toutes les entrées organisables, dans l'ordre choisi. */
  entries: NavCatalogEntry[];
  /** Leurs clés, dans le même ordre : l'ordre COMPLET qu'on enregistre. */
  keys: string[];
  /** L'ordre diffère de l'ordre par défaut (« Ordre par défaut » a à faire). */
  customOrder: boolean;
  pinning: RailPinning;
}

function libraryIcon(collectionType?: string): IconName {
  switch (collectionType?.toLowerCase()) {
    case "movies":
      return "film";
    case "tvshows":
      return "tv";
    default:
      return "layers";
  }
}

export function useNavCatalog(): NavCatalog {
  const { t } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();
  return useMemo(() => {
    const defaults: NavEntry[] = [
      { key: "Recommendations", label: t("forYou"), icon: "sparkles" },
      { key: "Watchlist", label: t("myList"), icon: "bookmark" },
      { key: "Favorites", label: t("common:myFavorites"), icon: "heart" },
      ...(libraries ?? []).map((library): NavEntry => ({
        key: `Library_${library.Id}`,
        label: library.Name,
        icon: libraryIcon(library.CollectionType),
      })),
    ];
    const entries = applyRailOrder(defaults, pinning.order, (entry) => entry.key).map(
      (entry): NavCatalogEntry => ({ ...entry, hidden: pinning.isHidden(entry.key) }),
    );
    const keys = entries.map((entry) => entry.key);
    return { entries, keys, customOrder: !sameRailOrder(keys, defaults.map((entry) => entry.key)), pinning };
  }, [t, libraries, pinning]);
}
