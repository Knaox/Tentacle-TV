import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { useRailPinning } from "./pinningTv";

/**
 * Ce que le rail propose, dans l'ordre où on le parcourt.
 *
 * **Tout est là par défaut.** La barre du haut du client web n'affiche que ce
 * qu'on y a épinglé, parce qu'elle n'a de place que pour trois ou quatre
 * destinations. Un rail vertical n'a pas cette contrainte, et un téléviseur
 * n'offrait aucun moyen d'épingler : hériter du défaut vide revenait à livrer
 * un serveur de huit bibliothèques derrière trois entrées dont aucune n'y mène.
 * On liste donc tout, et on retire ce dont on ne veut pas — c'est
 * `pinningTv.ts` qui tient cette liste.
 *
 * La recherche vient en tête plutôt qu'en bouton isolé : sur une télécommande,
 * une action qui n'est pas dans le chemin du D-pad est une action qu'on
 * n'utilise pas. Les réglages ferment la liste, loin des entrées de navigation
 * courante.
 *
 * « Tout afficher » n'apparaît que si quelque chose est masqué. C'est ce qui
 * empêche le masquage d'être une porte à sens unique, sans coûter une entrée
 * permanente à ceux qui n'y touchent jamais.
 */

export type RailIcon =
  | "recherche"
  | "accueil"
  | "liste"
  | "favoris"
  | "bibliotheque"
  | "reglages"
  | "restaurer";

export interface RailEntryItem {
  key: string;
  label: string;
  path: string;
  icon: RailIcon;
  /** Un maintien de OK la retire du rail. Faux pour la navigation de service. */
  hideable: boolean;
  /** Rend le rail à son état complet au lieu de naviguer. */
  restored?: boolean;
  /** Ouvre la surcouche de recherche au lieu de naviguer. */
  searching?: boolean;
}

export function useRailEntries(): RailEntryItem[] {
  const { t } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const pinning = useRailPinning();

  return useMemo(() => {
    const entries: RailEntryItem[] = [
      {
        key: "recherche",
        label: t("search"),
        // Le chemin n'est pas une destination : il n'existe aucune route de
        // recherche, ni ici ni sur le web. L'entrée reste un `<a href>` pour
        // que le moteur de navigation la recense comme les autres, et son
        // activation ouvre la surcouche.
        path: "/",
        icon: "recherche",
        hideable: false,
        searching: true,
      },
      { key: "accueil", label: t("home"), path: "/", icon: "accueil", hideable: false },
    ];

    const offered: RailEntryItem[] = [
      {
        key: "watchlist",
        label: t("myList"),
        path: "/watchlist",
        icon: "liste",
        hideable: true,
      },
      {
        key: "favorites",
        label: t("myFavorites"),
        path: "/favorites",
        icon: "favoris",
        hideable: true,
      },
    ];

    for (const library of libraries ?? []) {
      offered.push({
        key: `lib-${library.Id}`,
        label: library.Name,
        path: `/library/${library.Id}`,
        icon: "bibliotheque",
        hideable: true,
      });
    }

    for (const entry of offered) {
      if (!pinning.isHidden(entry.key)) entries.push(entry);
    }

    if (pinning.masquees.length > 0) {
      entries.push({
        key: "restaurer",
        label: t("railShowAll"),
        path: "/",
        icon: "restaurer",
        hideable: false,
        restored: true,
      });
    }

    entries.push({
      // `preferences` et non `settings` : c'est la clé que porte le namespace
      // `nav`, et une clé absente s'affiche telle quelle à l'écran.
      key: "reglages",
      label: t("preferences"),
      path: "/settings",
      icon: "reglages",
      hideable: false,
    });

    return entries;
  }, [t, libraries, pinning]);
}

/** L'entrée active, au chemin courant. */
export function activeEntry(entries: RailEntryItem[], path: string): string | null {
  for (const entry of entries) {
    if (entry.restored || entry.searching) continue;
    if (entry.path === "/") {
      if (path === "/") return entry.key;
      continue;
    }
    if (path === entry.path || path.startsWith(`${entry.path}/`)) return entry.key;
  }
  return null;
}
