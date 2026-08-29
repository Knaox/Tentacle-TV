import type { Root } from "postcss";
import {
  FORBIDDEN_DECLARATIONS,
  FORBIDDEN_VALUES,
  FORBIDDEN_SELECTORS,
  FORBIDDEN_DISPLAYS,
} from "./chrome53Catalog";
import { formatRefusal } from "./compatMessage";

export interface Survival {
  primitive: string;
  since: number;
  consequence: string;
  where: string;
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
 * La liste des survivals est rendue plutôt que levée : l'appelant décide
 * quoi en faire, et peut toutes les afficher au lieu de s'arrêter à la
 * première.
 */
export function compatGuard(root: Root): Survival[] {
  const survivals: Survival[] = [];

  root.walkDecls((declaration) => {
    const where = describeLocation(declaration.parent);

    const forbidden = FORBIDDEN_DECLARATIONS.find((entry) => entry.name === declaration.prop);
    // Une primitive mise à `none` est INERTE sur les deux moteurs, et c'est ce
    // qui rend l'exception sûre : un moteur qui ignore la propriété n'en fait
    // rien, un moteur qui la connaît en désactive l'effet. Dans les deux cas,
    // le rendu est celui de l'absence — ce que la garde cherche justement à
    // garantir. L'exception porte sur la VALEUR, jamais sur la propriété.
    //
    // Elle sert une seule règle, et une importante : la neutralisation
    // universelle du flou d'arrière-plan par `tv.css`, seule chose qui atteigne
    // les `backdropFilter` posés en style en ligne dans `apps/web`.
    if (forbidden && declaration.value.trim().toLowerCase() !== "none") {
      survivals.push({ ...forbidden, primitive: forbidden.name, where });
    }

    if (declaration.prop === "display" && FORBIDDEN_DISPLAYS.includes(declaration.value.trim())) {
      survivals.push({
        primitive: `display: ${declaration.value.trim()}`,
        since: 57,
        consequence: "la grille retombe en bloc, une seule affiche par ligne",
        where,
      });
    }

    for (const value of FORBIDDEN_VALUES) {
      if (!declaration.value.includes(value.name)) continue;
      survivals.push({ ...value, primitive: `${declaration.prop}: ${value.name}…`, where });
    }
  });

  root.walkRules((rule) => {
    for (const selector of FORBIDDEN_SELECTORS) {
      if (!rule.selector.includes(selector.name)) continue;
      survivals.push({ ...selector, primitive: selector.name, where: shorten(rule.selector) });
    }
  });

  return survivals;
}

/** Message d'erreur destiné à quelqu'un qui découvre le sujet. */
export function formatSurvivals(survivals: Survival[]): string {
  return formatRefusal(
    `${survivals.length} primitive(s) CSS trop récente(s) pour le socle du téléviseur :`,
    survivals.map((s) => `  ${s.primitive} (Chrome ${s.since}+) — ${s.consequence}\n      dans ${s.where}`),
    [
      "Le client téléviseur vise Chrome 53 (webOS 4.0). Soit la passe qui devait",
      "traiter cette primitive ne la reconnaît pas, soit il en est apparu une",
      "nouvelle — dans les deux cas, la corriger vaut mieux que la découvrir sur",
      "une dalle. Les passes vivent dans config/postcss/.",
    ],
  );
}

function describeLocation(parent: unknown): string {
  const rule = parent as { selector?: string } | undefined;
  return rule?.selector ? shorten(rule.selector) : "règle sans sélecteur";
}

function shorten(selector: string): string {
  return selector.length > 90 ? `${selector.slice(0, 87)}…` : selector;
}
