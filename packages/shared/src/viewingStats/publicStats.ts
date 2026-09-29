import type { ViewingStats, ViewingStatsTitle } from "../types/viewingStats";
import type { PublicStatsTitle, PublicViewingStats } from "../types/viewingStatsShare";

/**
 * La réponse publique remise à la forme des statistiques du propriétaire, pour
 * que la page partagée dessine avec les MÊMES cartes que « Vos statistiques ».
 *
 * Rien n'est inventé : ce que la réponse publique ne porte pas reste vide —
 * aucune grille (les habitudes la remplacent, cf. `habitsInsight`), aucun
 * écran, aucun fuseau, aucune date de dernière lecture, pas d'« À voir ». Les
 * cartes qui en vivent ne sont simplement pas montées sur la page publique.
 */
export function viewingStatsFromPublic(p: PublicViewingStats): ViewingStats {
  const title = (t: PublicStatsTitle): ViewingStatsTitle => ({ ...t, backdropTag: null, lastPlayedAt: null });
  return {
    period: p.period,
    timeZone: "",
    generatedAt: p.generatedAt,
    measuredSince: p.measuredSince,
    hasHistory: p.hasHistory,
    totals: p.totals,
    timeline: p.timeline,
    rhythm: { grid: [] },
    split: p.split,
    genres: p.genres,
    languages: [],
    origins: p.origins,
    listening: p.listening,
    decades: p.decades,
    devices: [],
    topSeries: p.topSeries.map(title),
    movies: p.movies.map(title),
    moviesOrder: "preference",
    people: p.people,
    records: p.records,
    taste: { ...p.taste, computedAt: null, potential: null },
  };
}
