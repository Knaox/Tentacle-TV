import type { Root } from "postcss";
import {
  DECLARATIONS_INTERDITES,
  VALEURS_INTERDITES,
  SELECTEURS_INTERDITS,
  AFFICHAGES_INTERDITS,
} from "./catalogueChrome53";
import { formaterRefus } from "./messageCompat";

export interface Survivance {
  primitive: string;
  depuis: number;
  consequence: string;
  ou: string;
}

/**
 * Dernière passe, purement lectrice : elle ne corrige rien, elle refuse.
 *
 * C'est la seule protection contre une régression introduite dans six mois par
 * quelqu'un qui n'aura aucune raison de penser au téléviseur. Il ajoutera une
 * classe quelque part dans `apps/web`, Tailwind produira une primitive trop
 * récente, et le seul symptôme serait une mise en page effondrée sur une
 * machine que personne n'a sous la main. Ici, le build s'arrête.
 *
 * La liste des survivances est rendue plutôt que levée : l'appelant décide
 * quoi en faire, et peut toutes les afficher au lieu de s'arrêter à la
 * première.
 */
export function gardeCompat(racine: Root): Survivance[] {
  const survivances: Survivance[] = [];

  racine.walkDecls((declaration) => {
    const ou = decrireEmplacement(declaration.parent);

    const interdite = DECLARATIONS_INTERDITES.find((entree) => entree.nom === declaration.prop);
    // Une primitive mise à `none` est INERTE sur les deux moteurs, et c'est ce
    // qui rend l'exception sûre : un moteur qui ignore la propriété n'en fait
    // rien, un moteur qui la connaît en désactive l'effet. Dans les deux cas,
    // le rendu est celui de l'absence — ce que la garde cherche justement à
    // garantir. L'exception porte sur la VALEUR, jamais sur la propriété.
    //
    // Elle sert une seule règle, et une importante : la neutralisation
    // universelle du flou d'arrière-plan par `tv.css`, seule chose qui atteigne
    // les `backdropFilter` posés en style en ligne dans `apps/web`.
    if (interdite && declaration.value.trim().toLowerCase() !== "none") {
      survivances.push({ ...interdite, primitive: interdite.nom, ou });
    }

    if (declaration.prop === "display" && AFFICHAGES_INTERDITS.includes(declaration.value.trim())) {
      survivances.push({
        primitive: `display: ${declaration.value.trim()}`,
        depuis: 57,
        consequence: "la grille retombe en bloc, une seule affiche par ligne",
        ou,
      });
    }

    for (const valeur of VALEURS_INTERDITES) {
      if (!declaration.value.includes(valeur.nom)) continue;
      survivances.push({ ...valeur, primitive: `${declaration.prop}: ${valeur.nom}…`, ou });
    }
  });

  racine.walkRules((regle) => {
    for (const selecteur of SELECTEURS_INTERDITS) {
      if (!regle.selector.includes(selecteur.nom)) continue;
      survivances.push({ ...selecteur, primitive: selecteur.nom, ou: abreger(regle.selector) });
    }
  });

  return survivances;
}

/** Message d'erreur destiné à quelqu'un qui découvre le sujet. */
export function formaterSurvivances(survivances: Survivance[]): string {
  return formaterRefus(
    `${survivances.length} primitive(s) CSS trop récente(s) pour le socle du téléviseur :`,
    survivances.map((s) => `  ${s.primitive} (Chrome ${s.depuis}+) — ${s.consequence}\n      dans ${s.ou}`),
    [
      "Le client téléviseur vise Chrome 53 (webOS 4.0). Soit la passe qui devait",
      "traiter cette primitive ne la reconnaît pas, soit il en est apparu une",
      "nouvelle — dans les deux cas, la corriger vaut mieux que la découvrir sur",
      "une dalle. Les passes vivent dans config/postcss/.",
    ],
  );
}

function decrireEmplacement(parent: unknown): string {
  const regle = parent as { selector?: string } | undefined;
  return regle?.selector ? abreger(regle.selector) : "règle sans sélecteur";
}

function abreger(selecteur: string): string {
  return selecteur.length > 90 ? `${selecteur.slice(0, 87)}…` : selecteur;
}
