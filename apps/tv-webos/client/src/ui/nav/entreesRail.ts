import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { usePinnedNav } from "@/hooks/usePinnedNav";

/**
 * Ce que le rail propose, dans l'ordre où on le parcourt.
 *
 * Reprend la construction de `TopNavLinks` — mêmes préférences d'épinglage,
 * mêmes bibliothèques — moins les entrées de plugins, qui ne sont pas
 * compilées dans le bundle téléviseur.
 *
 * La recherche vient en tête plutôt qu'en bouton isolé : sur une télécommande,
 * une action qui n'est pas dans le chemin du D-pad est une action qu'on
 * n'utilise pas. Les réglages ferment la liste, loin des entrées de navigation
 * courante.
 */

export type IconeRail =
  | "recherche"
  | "accueil"
  | "liste"
  | "favoris"
  | "bibliotheque"
  | "reglages";

export interface EntreeRail {
  cle: string;
  libelle: string;
  chemin: string;
  icone: IconeRail;
}

export function useEntreesRail(): EntreeRail[] {
  const { t } = useTranslation("nav");
  const { data: bibliotheques } = useLibraries();
  const epingle = usePinnedNav();

  return useMemo(() => {
    const entrees: EntreeRail[] = [
      { cle: "recherche", libelle: t("search"), chemin: "/recherche", icone: "recherche" },
      { cle: "accueil", libelle: t("home"), chemin: "/", icone: "accueil" },
    ];

    if (epingle.watchlist) {
      entrees.push({ cle: "watchlist", libelle: t("myList"), chemin: "/watchlist", icone: "liste" });
    }
    if (epingle.favorites) {
      entrees.push({
        cle: "favorites",
        libelle: t("myFavorites"),
        chemin: "/favorites",
        icone: "favoris",
      });
    }

    for (const bibliotheque of bibliotheques ?? []) {
      if (!epingle.isLibraryPinned(bibliotheque.Id)) continue;
      entrees.push({
        cle: `lib-${bibliotheque.Id}`,
        libelle: bibliotheque.Name,
        chemin: `/library/${bibliotheque.Id}`,
        icone: "bibliotheque",
      });
    }

    entrees.push({
      // `preferences` et non `settings` : c'est la clé que porte le namespace
      // `nav`, et une clé absente s'affiche telle quelle à l'écran.
      cle: "reglages",
      libelle: t("preferences"),
      chemin: "/settings",
      icone: "reglages",
    });

    return entrees;
  }, [t, bibliotheques, epingle]);
}

/** L'entrée active, au chemin courant. */
export function entreeActive(entrees: EntreeRail[], chemin: string): string | null {
  for (const entree of entrees) {
    if (entree.chemin === "/") {
      if (chemin === "/") return entree.cle;
      continue;
    }
    if (chemin === entree.chemin || chemin.startsWith(`${entree.chemin}/`)) return entree.cle;
  }
  return null;
}
