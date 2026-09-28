import type { ViewingStats, ViewingStatsListening, ViewingStatsTitle } from "../types/viewingStats";

/**
 * Ce que la page dit d'un titre classé et de l'écoute — une seule lecture
 * pour le web et le mobile.
 */

/** Un avis à montrer sous un titre, dans l'ordre du classement des films. */
export type StatsTitleReason =
  | { kind: "rating"; value: number }
  | { kind: "superlike" | "like" | "dislike" | "favorite" }
  | { kind: "viewings"; value: number };

/** Les avis d'un titre : votre note, votre verdict, le favori, puis les revisionnages (dès 2). */
export function titleReasons(t: ViewingStatsTitle): StatsTitleReason[] {
  const out: StatsTitleReason[] = [];
  if (t.rating !== null) out.push({ kind: "rating", value: t.rating });
  if (t.verdict) out.push({ kind: t.verdict });
  if (t.favorite) out.push({ kind: "favorite" });
  if (t.kind === "movie" && t.viewings >= 2) out.push({ kind: "viewings", value: t.viewings });
  return out;
}

/** Un titre a-t-il gagné une place de « préféré » ? Une note de 6 ou plus, un avis positif, ou revu. */
export function isLovedTitle(t: ViewingStatsTitle): boolean {
  return (
    (t.rating !== null && t.rating >= 6) ||
    t.verdict === "superlike" ||
    t.verdict === "like" ||
    t.favorite ||
    t.viewings >= 2
  );
}

/**
 * Comment lire l'ordre des films : par vos avis ; au temps passé quand vous
 * n'avez encore rien dit d'aucun (le classement départage alors au temps) ;
 * les plus récents d'abord pour un serveur plus ancien.
 */
export type MoviesRankMode = "preference" | "time" | "recent";

export function moviesRankMode(stats: Pick<ViewingStats, "movies" | "moviesOrder">): MoviesRankMode {
  if (stats.moviesOrder === "recent") return "recent";
  return stats.movies.some(isLovedTitle) ? "preference" : "time";
}

/** « VF ou VO ? » : caché (jamais relevé), en attente (échantillon trop mince) ou prêt. */
export type ListeningState = "hidden" | "pending" | "ready";

export function listeningState(l: ViewingStatsListening): ListeningState {
  if (l.versions !== null || l.languages.length > 0) return "ready";
  return l.since ? "pending" : "hidden";
}

export type ListeningVersion = "local" | "original" | "otherDubs";
export const LISTENING_VERSIONS: readonly ListeningVersion[] = ["local", "original", "otherDubs"];

/** La version qui domine l'écoute, et sa part ; null sans base VF/VO. */
export function listeningHeadline(l: ViewingStatsListening): { version: ListeningVersion; share: number } | null {
  const versions = l.versions;
  if (!versions) return null;
  let best: { version: ListeningVersion; share: number } | null = null;
  for (const version of LISTENING_VERSIONS) {
    if (versions[version] > (best?.share ?? 0)) best = { version, share: versions[version] };
  }
  return best;
}
