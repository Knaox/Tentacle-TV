import type { ViewingStats, ViewingStatsTitle } from "../types/viewingStats";

/**
 * La réponse d'un serveur plus ancien, remise à la forme du contrat — sans
 * rien inventer : ce qu'il ne sait pas dire reste vide, et la page tait la
 * section plutôt que d'afficher un chiffre qu'il n'a pas calculé.
 *
 * Un serveur d'avant l'origine et l'écoute envoie encore `languages` (la
 * langue ORIGINALE des titres, le chiffre trompeur) : on ne la lit plus. Sans
 * potentiels, la tuile « À voir » se tait.
 * Ses films sont triés par date (`moviesOrder: "recent"`) et n'ont pas
 * d'avis ; tous sont vus au moins une fois (il ne liste que ceux-là).
 */

type Legacy = Omit<ViewingStats, "origins" | "listening" | "moviesOrder"> & Partial<ViewingStats>;

function withJudgments(t: ViewingStatsTitle, legacy: boolean): ViewingStatsTitle {
  return {
    ...t,
    rating: t.rating ?? null,
    favorite: t.favorite ?? false,
    verdict: t.verdict ?? null,
    viewings: legacy && t.kind === "movie" ? Math.max(1, t.viewings) : t.viewings,
  };
}

export function withViewingStatsDefaults(raw: Legacy): ViewingStats {
  const legacy = raw.moviesOrder === undefined;
  const binge = raw.records.binge;
  return {
    ...raw,
    origins: raw.origins ?? { countries: [], otherShare: 0, unknownShare: 0 },
    listening: raw.listening ?? { versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null },
    moviesOrder: raw.moviesOrder ?? "recent",
    movies: raw.movies.map((m) => withJudgments(m, legacy)),
    topSeries: raw.topSeries.map((s) => withJudgments(s, legacy)),
    // Un ancien marathon se comptait en épisodes : sans sa durée, il ne fait aucun trait.
    records: binge && binge.seconds === undefined ? { ...raw.records, binge: { ...binge, seconds: 0 } } : raw.records,
    taste: raw.taste && raw.taste.potential === undefined ? { ...raw.taste, potential: null } : raw.taste,
  };
}
