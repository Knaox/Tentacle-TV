import { useSectionEntry, useFirstVisitEntry } from "@bench/sectionEntry";

/**
 * L'arbre courant : les mêmes entrées de la fiche, écrites avec la primitive
 * d'entrée de section (`useSectionEntry` + `useFirstVisitEntry`) comme T7 la
 * branche — saison affichée toujours, épisode à reprendre à la première
 * visite, réarmé à chaque saison choisie.
 */

interface Episodes {
  seasons: Array<{ id: string }>;
  selectedSeasonId: string;
  episodes: unknown[];
  anchorIndex?: number;
}

type Store = Parameters<typeof useSectionEntry>[0];

export function useDetailEntries(focus: Store, episodes: Episodes | null | undefined): void {
  const selected = episodes ? episodes.seasons.findIndex((season) => season.id === episodes.selectedSeasonId) : -1;
  const season = selected >= 0 ? `season:${selected}` : null;
  const episode = episodes?.episodes?.length ? `episode:${episodes.anchorIndex ?? 0}` : null;
  useSectionEntry(focus, "detail:seasons", season);
  const entry = useFirstVisitEntry(focus, { owns: (key) => key.startsWith("episode:"), anchorKey: episode, resetKey: episodes?.selectedSeasonId });
  useSectionEntry(focus, "detail:episodes", entry);
}
