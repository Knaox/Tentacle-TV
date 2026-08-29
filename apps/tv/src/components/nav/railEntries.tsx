import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { possessiveLibraryName } from "../../utils/libraryLabel";
import {
  HomeIcon, SearchIcon, LibraryIcon, SettingsIcon,
  TVIcon, MusicIcon, BookIcon, BookmarkIcon,
} from "../icons/TVIcons";
import { EyeIcon, HeartNavIcon } from "../icons/TVNavIcons";
import { useRailPinning } from "./railPinning";

const ICON_SIZE = 26;

export interface RailItem {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  danger?: boolean;
  /** Un maintien de OK la retire du rail. Faux pour la navigation de service. */
  hideable?: boolean;
  /** Rend le rail à son état complet au lieu de naviguer. */
  restores?: boolean;
}

function libraryIcon(collectionType?: string) {
  return (color: string) => {
    switch (collectionType?.toLowerCase()) {
      case "tvshows": return <TVIcon size={ICON_SIZE} color={color} />;
      case "music": return <MusicIcon size={ICON_SIZE} color={color} />;
      case "books": return <BookIcon size={ICON_SIZE} color={color} />;
      default: return <LibraryIcon size={ICON_SIZE} color={color} />;
    }
  };
}

/**
 * Ce que le rail propose, dans l'ordre où on le parcourt.
 *
 * **Tout est là par défaut**, et on retire ce dont on ne veut pas — c'est
 * `railPinning` qui tient la liste des entrées masquées, partagée avec la LG.
 * La sémantique inverse (n'afficher que ce qu'on a épinglé) livrerait un
 * serveur de huit bibliothèques derrière deux entrées dont aucune n'y mène.
 *
 * « Tout afficher » n'apparaît que si quelque chose est masqué : c'est ce qui
 * empêche le masquage d'être une porte à sens unique, sans coûter une entrée
 * permanente à ceux qui n'y touchent jamais.
 *
 * Le groupe du bas — les Réglages — n'est pas masquable : ce n'est pas de la
 * navigation qu'on parcourt.
 */
export function useRailEntries(): { top: RailItem[]; bottom: RailItem[] } {
  const { t, i18n } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();

  return useMemo(() => {
    const top: RailItem[] = [
      { key: "Search", label: t("search"), icon: (c) => <SearchIcon size={ICON_SIZE} color={c} /> },
      { key: "Home", label: t("home"), icon: (c) => <HomeIcon size={ICON_SIZE} color={c} /> },
    ];

    // Ma liste et Favoris — entre l'accueil et les bibliothèques, masquables,
    // exactement l'ordre du rail de la LG.
    if (!pinning.isHidden("Watchlist")) {
      top.push({
        key: "Watchlist",
        label: t("myList"),
        icon: (c) => <BookmarkIcon size={ICON_SIZE} color={c} />,
        hideable: true,
      });
    }
    if (!pinning.isHidden("Favorites")) {
      top.push({
        key: "Favorites",
        label: t("common:myFavorites"),
        icon: (c) => <HeartNavIcon size={ICON_SIZE} color={c} />,
        hideable: true,
      });
    }

    for (const library of libraries ?? []) {
      const entryKey = `Library_${library.Id}`;
      if (pinning.isHidden(entryKey)) continue;
      top.push({
        key: entryKey,
        label: possessiveLibraryName(library.Name, i18n.language),
        icon: libraryIcon(library.CollectionType),
        hideable: true,
      });
    }

    if (pinning.masquees.length > 0) {
      top.push({
        key: "RailShowAll",
        label: t("railShowAll"),
        icon: (c) => <EyeIcon size={ICON_SIZE} color={c} />,
        restores: true,
      });
    }

    // Une seule entrée de service, comme la LG : « Changer de serveur » et
    // « Déconnexion » ont déménagé dans Réglages → Compte (sans rien perdre).
    const bottom: RailItem[] = [
      { key: "Settings", label: t("preferences"), icon: (c) => <SettingsIcon size={ICON_SIZE} color={c} /> },
    ];

    return { top, bottom };
  }, [t, i18n.language, libraries, pinning]);
}
