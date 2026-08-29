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

import { startupTimeline } from "../hooks/startupTrace";
import type { DebugSection } from "./playerDebugTypes";

export function startupSection(): DebugSection {
  const { entries, rebuffers, loads, context } = startupTimeline();
  if (entries.length === 0) {
    return {
      title: "Démarrage",
      lines: [["chronologie", "aucune lecture depuis l'ouverture", null]],
    };
  }

  const firstFrame = entries.find((e) => e.label.startsWith("playback-restart"));
  const lines: DebugSection["lines"] = [
    ["source", context, null],
    // Les deux formes que peut prendre le second chargement, distinguées : une
    // coupure de mpv (le cache s'est vidé) ou une source rechargée (l'app a
    // refait un loadfile). Elles n'ont ni la même cause ni le même remède.
    ["coupures", String(rebuffers), rebuffers === 0],
    ["chargements", String(loads), loads === 1],
    [
      "première image",
      firstFrame ? `${(firstFrame.ms / 1000).toFixed(2)} s` : "pas encore",
      firstFrame ? null : false,
    ],
  ];

  // `key` du panneau = la clé de ligne : le rang la rend unique, deux entrées
  // pouvant tomber sur la même milliseconde.
  entries.forEach((e, i) => {
    lines.push([
      `${i + 1} · +${(e.ms / 1000).toFixed(2)} s`,
      `${e.origin === "app" ? "→ " : ""}${e.label}${e.detail ? ` · ${e.detail}` : ""}`,
      null,
    ]);
  });

  return { title: "Démarrage", lines };
}
