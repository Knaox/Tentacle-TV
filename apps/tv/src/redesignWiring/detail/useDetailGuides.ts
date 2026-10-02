import { useEffect, useRef, useState } from "react";
import type { EpisodesModel } from "../../redesign/screens/detail/detailTypes";
import type { FocusExtras, FocusStore } from "../focus/focusStore";
import { useSectionEntry } from "../focus/sectionEntry";

/**
 * Le focus des sections de la fiche (`FocusSection` de `DetailView`). HAUT /
 * BAS suivent la règle de voisinage commune — la section voisine, l'élément
 * au centre le plus proche (`focus/sectionNeighbors.ts`) — qui remplace les
 * entrées mémorisées d'avant (dernière carte visitée, dernière action de
 * l'en-tête). Deux exceptions, tranchées le 2026-10-01 :
 * - `detail:seasons` entre TOUJOURS par l'onglet de la saison AFFICHÉE : un
 *   sélecteur entre par sa sélection (le focus d'un onglet ne change pas la
 *   saison, seul OK le fait) ;
 * - `detail:episodes` entre par l'épisode À REPRENDRE à sa première entrée —
 *   l'arrivée sur la fiche, puis chaque saison choisie par OK ; ensuite, dans
 *   la même visite, au plus proche (la rangée reste où on l'a laissée).
 * Les bouts des rangées retiennent le focus : de côté, rien à atteindre.
 *
 * Liés une fois, au premier rendu, avant que les sections se montent.
 */

const ROWS = ["detail:seasons", "detail:episodes", "detail:cast", "detail:extras", "detail:saga", "detail:collection", "detail:similar"];
const SIDES: FocusExtras = { native: { trapFocusLeft: true, trapFocusRight: true } };

function keysOf(episodes: EpisodesModel | null | undefined) {
  const selected = episodes ? episodes.seasons.findIndex((season) => season.id === episodes.selectedSeasonId) : -1;
  return {
    season: selected >= 0 ? `season:${selected}` : null,
    episode: episodes?.episodes?.length ? `episode:${episodes.anchorIndex ?? 0}` : null,
  };
}

export function useDetailGuides(focus: FocusStore, episodes: EpisodesModel | null | undefined): void {
  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    for (const key of ROWS) focus.bind(key, SIDES);
  }

  const { season, episode } = keysOf(episodes);
  // L'épisode à reprendre ne vaut que pour la première entrée de la visite —
  // réarmé à chaque saison choisie.
  const [armed, setArmed] = useState(true);
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const seasonId = episodes?.selectedSeasonId;
  useEffect(() => setArmed(true), [seasonId]);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused && armedRef.current && key.startsWith("episode:")) setArmed(false);
      }),
    [focus],
  );

  useSectionEntry(focus, "detail:seasons", season);
  useSectionEntry(focus, "detail:episodes", armed ? episode : null);
}
