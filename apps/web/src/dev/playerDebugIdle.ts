/**
 * Le diagnostic quand mpv ne lit RIEN — DÉVELOPPEMENT UNIQUEMENT, libellés en clair.
 *
 * Les verdicts (`playerDebugVerdict.ts`) jugent une lecture de mpv. Sans elle, ses propriétés
 * sont toutes vides, et chaque verdict concluait quand même : « lecture directe », « LOCAL » et,
 * en rouge, « LOGICIEL — le processeur décode » — sur une application au repos, et pire, pendant
 * que le lecteur WEB de secours lisait (recette du lot rf2 : après une panne provoquée, le
 * diagnostic décrivait une lecture mpv qui n'existait plus).
 */

import type { Verdict } from "./playerDebugVerdict";

/** mpv a-t-il un fichier chargé ? `path` est la seule propriété qui ne vaut rien sans lecture. */
export function hasMpvPlayback(props: Readonly<Record<string, string | null>>): boolean {
  const path = props["path"];
  return path !== null && path !== undefined && path !== "";
}

/** L'unique ligne à montrer à la place des verdicts : qui a la main, sans rien juger. */
export function idleVerdict(webPlayerInCharge: boolean): Verdict {
  return {
    key: "Lecture",
    value: webPlayerInCharge ? "aucune lecture mpv — le lecteur web a la main" : "aucune lecture mpv en cours",
    good: null,
  };
}
