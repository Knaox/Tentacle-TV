import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { useEpinglageRail } from "./pinningTv";

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

export type IconeRail =
  | "recherche"
  | "accueil"
  | "liste"
  | "favoris"
  | "bibliotheque"
  | "reglages"
  | "restaurer";

export interface EntreeRail {
  cle: string;
  libelle: string;
  chemin: string;
  icone: IconeRail;
  /** Un maintien de OK la retire du rail. Faux pour la navigation de service. */
  masquable: boolean;
  /** Rend le rail à son état complet au lieu de naviguer. */
  restaure?: boolean;
  /** Ouvre la surcouche de recherche au lieu de naviguer. */
  cherche?: boolean;
}

export function useEntreesRail(): EntreeRail[] {
  const { t } = useTranslation("nav");
  const { data: bibliotheques } = useLibraries();
  const epinglage = useEpinglageRail();

  return useMemo(() => {
    const entrees: EntreeRail[] = [
      {
        cle: "recherche",
        libelle: t("search"),
        // Le chemin n'est pas une destination : il n'existe aucune route de
        // recherche, ni ici ni sur le web. L'entrée reste un `<a href>` pour
        // que le moteur de navigation la recense comme les autres, et son
        // activation ouvre la surcouche.
        chemin: "/",
        icone: "recherche",
        masquable: false,
        cherche: true,
      },
      { cle: "accueil", libelle: t("home"), chemin: "/", icone: "accueil", masquable: false },
    ];

    const proposees: EntreeRail[] = [
      {
        cle: "watchlist",
        libelle: t("myList"),
        chemin: "/watchlist",
        icone: "liste",
        masquable: true,
      },
      {
        cle: "favorites",
        libelle: t("myFavorites"),
        chemin: "/favorites",
        icone: "favoris",
        masquable: true,
      },
    ];

    for (const bibliotheque of bibliotheques ?? []) {
      proposees.push({
        cle: `lib-${bibliotheque.Id}`,
        libelle: bibliotheque.Name,
        chemin: `/library/${bibliotheque.Id}`,
        icone: "bibliotheque",
        masquable: true,
      });
    }

    for (const entree of proposees) {
      if (!epinglage.estMasquee(entree.cle)) entrees.push(entree);
    }

    if (epinglage.masquees.length > 0) {
      entrees.push({
        cle: "restaurer",
        libelle: t("railShowAll"),
        chemin: "/",
        icone: "restaurer",
        masquable: false,
        restaure: true,
      });
    }

    entrees.push({
      // `preferences` et non `settings` : c'est la clé que porte le namespace
      // `nav`, et une clé absente s'affiche telle quelle à l'écran.
      cle: "reglages",
      libelle: t("preferences"),
      chemin: "/settings",
      icone: "reglages",
      masquable: false,
    });

    return entrees;
  }, [t, bibliotheques, epinglage]);
}

/** L'entrée active, au chemin courant. */
export function entreeActive(entrees: EntreeRail[], chemin: string): string | null {
  for (const entree of entrees) {
    if (entree.restaure || entree.cherche) continue;
    if (entree.chemin === "/") {
      if (chemin === "/") return entree.cle;
      continue;
    }
    if (chemin === entree.chemin || chemin.startsWith(`${entree.chemin}/`)) return entree.cle;
  }
  return null;
}
