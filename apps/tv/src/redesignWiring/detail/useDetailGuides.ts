import { useRef } from "react";
import type { EpisodesModel } from "../../redesign/screens/detail/detailTypes";
import { createEntryGuide, rowItems } from "../focus/entryGuide";
import type { FocusStore } from "../focus/focusStore";

/**
 * Les guides d'entrée des groupes de la fiche (`FocusGroup` de `DetailView`),
 * éprouvés au banc à la télécommande :
 * - `detail:header` (le premier écran, pleine largeur) : HAUT depuis une
 *   section rejoint la dernière action de l'en-tête, sinon l'entrée — même
 *   depuis la droite de l'écran, où rien de l'en-tête n'est au-dessus ;
 * - `detail:seasons` : toujours l'onglet de la saison AFFICHÉE (pas celui qui
 *   se trouve sous le bouton d'où l'on descend) ;
 * - `detail:episodes` : le dernier épisode visité, sinon celui sur lequel la
 *   rangée s'ouvre (reprise, épisode ouvert) — pas celui sous l'onglet ;
 * - les rangées (distribution, extras, saga, collection, similaires) : la
 *   dernière carte visitée, sinon la première.
 * Les bouts des rangées retiennent le focus : de côté, rien à atteindre.
 *
 * Liés une fois, au premier rendu, avant que les groupes se montent : le port
 * veut des conteneurs stables. Ce qui change (l'entrée, la saison affichée,
 * l'épisode d'ouverture) est relu à chaque visée.
 */

const ROWS: ReadonlyArray<readonly [group: string, prefix: string]> = [
  ["detail:cast", "cast"],
  ["detail:extras", "extra"],
  ["detail:saga", "saga"],
  ["detail:collection", "collection"],
  ["detail:similar", "similar"],
];

function keysOf(episodes: EpisodesModel | null | undefined) {
  const selected = episodes ? episodes.seasons.findIndex((season) => season.id === episodes.selectedSeasonId) : -1;
  return {
    season: selected >= 0 ? `season:${selected}` : null,
    episode: episodes?.episodes?.length ? `episode:${episodes.anchorIndex ?? 0}` : null,
  };
}

export function useDetailGuides(focus: FocusStore, entryKey: string | null, episodes: EpisodesModel | null | undefined): void {
  const live = useRef({ entryKey, ...keysOf(episodes) });
  live.current = { entryKey, ...keysOf(episodes) };

  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    const sides = { trapLeft: true, trapRight: true };
    focus.bind("detail:header", {
      // La croix n'est pas de l'en-tête (sa bande est au-dessus) : HAUT depuis une section n'y retourne jamais.
      container: createEntryGuide(focus, { owns: (key) => key.startsWith("detail:") && key !== "detail:back", fallback: () => live.current.entryKey }),
    });
    focus.bind("detail:seasons", {
      container: createEntryGuide(focus, { owns: rowItems("season"), fallback: () => live.current.season, remember: false, ...sides }),
    });
    focus.bind("detail:episodes", {
      container: createEntryGuide(focus, { owns: rowItems("episode"), fallback: () => live.current.episode, ...sides }),
    });
    for (const [group, prefix] of ROWS) {
      focus.bind(group, { container: createEntryGuide(focus, { owns: rowItems(prefix), fallback: () => `${prefix}:0`, ...sides }) });
    }
  }
}
