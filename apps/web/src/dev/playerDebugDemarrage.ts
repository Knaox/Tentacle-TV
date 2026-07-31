/**
 * Section « Démarrage » du panneau : la chronologie du dernier `loadfile`.
 *
 * Ce qu'on vient y chercher, dans cet ordre : combien de fois la lecture s'est
 * interrompue pour attendre le cache (zéro est l'objectif), au bout de combien
 * de temps la première image est sortie, et — s'il reste une coupure — si elle
 * suit une commande que NOUS avons envoyée (préfixée `→`) ou un simple
 * assèchement du réseau.
 *
 * La donnée vient de `hooks/startupTrace.ts`, qui la collecte : elle doit
 * survivre en build de production instrumenté, là où `wtLog` est déjà mort.
 */

import { chronologieDemarrage } from "../hooks/startupTrace";
import type { DebugSection } from "./playerDebugTypes";

export function sectionDemarrage(): DebugSection {
  const { entrees, rebuffers, contexte } = chronologieDemarrage();
  if (entrees.length === 0) {
    return {
      titre: "Démarrage",
      lignes: [["chronologie", "aucune lecture depuis l'ouverture", null]],
    };
  }

  const premiereImage = entrees.find((e) => e.label.startsWith("playback-restart"));
  const lignes: DebugSection["lignes"] = [
    ["source", contexte, null],
    // Le verdict. Une coupure après la première image, c'est le second
    // chargement qu'on traque ; avant, c'est le remplissage voulu.
    ["coupures", String(rebuffers), rebuffers === 0],
    [
      "première image",
      premiereImage ? `${(premiereImage.ms / 1000).toFixed(2)} s` : "pas encore",
      premiereImage ? null : false,
    ],
  ];

  // `key` du panneau = la clé de ligne : le rang la rend unique, deux entrées
  // pouvant tomber sur la même milliseconde.
  entrees.forEach((e, i) => {
    lignes.push([
      `${i + 1} · +${(e.ms / 1000).toFixed(2)} s`,
      `${e.origine === "app" ? "→ " : ""}${e.label}${e.detail ? ` · ${e.detail}` : ""}`,
      null,
    ]);
  });

  return { titre: "Démarrage", lignes };
}
