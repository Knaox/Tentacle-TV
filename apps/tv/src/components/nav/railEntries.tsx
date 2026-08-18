import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { possessiveLibraryName } from "../../utils/libraryLabel";
import {
  HomeIcon, SearchIcon, LibraryIcon, SettingsIcon, InfoIcon,
  LogoutIcon, TVIcon, MusicIcon, BookIcon, ServerIcon,
} from "../icons/TVIcons";
import { EyeIcon } from "../icons/TVNavIcons";
import { useEpinglageRail } from "./railPinning";

const TAILLE_ICONE = 26;

export interface RailItem {
  key: string;
  label: string;
  icon: (color: string) => ReactNode;
  danger?: boolean;
  /** Un maintien de OK la retire du rail. Faux pour la navigation de service. */
  masquable?: boolean;
  /** Rend le rail à son état complet au lieu de naviguer. */
  restaure?: boolean;
}

function iconeBibliotheque(collectionType?: string) {
  return (couleur: string) => {
    switch (collectionType?.toLowerCase()) {
      case "tvshows": return <TVIcon size={TAILLE_ICONE} color={couleur} />;
      case "music": return <MusicIcon size={TAILLE_ICONE} color={couleur} />;
      case "books": return <BookIcon size={TAILLE_ICONE} color={couleur} />;
      default: return <LibraryIcon size={TAILLE_ICONE} color={couleur} />;
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
 * Le groupe du bas — réglages, à propos, changement de serveur, déconnexion —
 * n'est pas masquable : ce n'est pas de la navigation qu'on parcourt.
 */
export function useRailEntries(): { haut: RailItem[]; bas: RailItem[] } {
  const { t, i18n } = useTranslation("nav");
  const { data: bibliotheques } = useLibraries();
  const epinglage = useEpinglageRail();

  return useMemo(() => {
    const haut: RailItem[] = [
      { key: "Search", label: t("search"), icon: (c) => <SearchIcon size={TAILLE_ICONE} color={c} /> },
      { key: "Home", label: t("home"), icon: (c) => <HomeIcon size={TAILLE_ICONE} color={c} /> },
    ];

    for (const bibliotheque of bibliotheques ?? []) {
      const cle = `Library_${bibliotheque.Id}`;
      if (epinglage.estMasquee(cle)) continue;
      haut.push({
        key: cle,
        label: possessiveLibraryName(bibliotheque.Name, i18n.language),
        icon: iconeBibliotheque(bibliotheque.CollectionType),
        masquable: true,
      });
    }

    if (epinglage.masquees.length > 0) {
      haut.push({
        key: "RailShowAll",
        label: t("railShowAll"),
        icon: (c) => <EyeIcon size={TAILLE_ICONE} color={c} />,
        restaure: true,
      });
    }

    const bas: RailItem[] = [
      { key: "Preferences", label: t("preferences"), icon: (c) => <SettingsIcon size={TAILLE_ICONE} color={c} /> },
      { key: "About", label: t("about"), icon: (c) => <InfoIcon size={TAILLE_ICONE} color={c} /> },
      { key: "ChangeServer", label: t("changeServer"), icon: (c) => <ServerIcon size={TAILLE_ICONE} color={c} /> },
      { key: "Logout", label: t("logout"), icon: (c) => <LogoutIcon size={TAILLE_ICONE} color={c} />, danger: true },
    ];

    return { haut, bas };
  }, [t, i18n.language, bibliotheques, epinglage]);
}
