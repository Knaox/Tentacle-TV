import { useEffect, useRef } from "react";
import {
  DETAIL_BACK_BAR_KEY,
  DETAIL_BACK_KEY,
  DETAIL_EPISODES_SECTION,
  DETAIL_ROWS,
  DETAIL_ROW_EDGES,
  DETAIL_SEASONS_SECTION,
  detailEntryAfterPlayLost,
  detailEpisodeAnchorKey,
  detailSeasonEntryKey,
  isDetailEpisodeKey,
} from "@tentacle-tv/tv-core";
import { useBackFocus } from "../../../redesignWiring/focus/backFocus";
import type { FocusExtras, FocusStore } from "../focus/focusStore";
import { useFirstVisitEntry, useSectionEntry } from "../focus/sectionEntry";
import { useEntryFocus } from "../focus/useEntryFocus";

/**
 * L'applicateur tvOS du focus de la FICHE — les décisions sont celles de
 * tv-core (`focus/detailFocus.ts`, relevé `docs/tv-navigation/ecrans.md`,
 * FI-1 à FI-8) ; ce module ne fait que les poser avec les outils natifs :
 * - l'entrée et le retour sur l'écran (`useEntryFocus`), la croix Retour et
 *   sa bande (`useBackFocus`) ;
 * - les bouts des rangées piégés (`trapFocusLeft` / `trapFocusRight` de leur
 *   section, liés au premier rendu, avant que les sections ne se montent) ;
 * - l'entrée des onglets (la saison affichée) et celle des épisodes (l'ancre,
 *   à la première visite : `useFirstVisitEntry`, réarmée par la saison) ;
 * - la pilule de lecture perdue sous le focus : la nouvelle entrée réclamée.
 */

const ROW_EDGES: FocusExtras = {
  native: { trapFocusLeft: DETAIL_ROW_EDGES.trapLeft, trapFocusRight: DETAIL_ROW_EDGES.trapRight },
};

export interface DetailFocusInput {
  /** L'entrée de la fiche (`detailEntryKey`). */
  entryKey: string | null;
  /** Les saisons de la bande, dans l'ordre (sans les onglets grisés), et l'affichée. */
  seasonIds: readonly string[];
  selectedSeasonId: string | null | undefined;
  /** Les épisodes de la saison montrée, et l'index de l'ancre. */
  episodeCount: number;
  anchorIndex: number | null | undefined;
  /** La pilule de lecture existe. */
  hasPlay: boolean;
}

export function useDetailFocus(focus: FocusStore, input: DetailFocusInput): void {
  const { entryKey, hasPlay } = input;
  useEntryFocus(focus, entryKey);
  useBackFocus(focus, { backKey: DETAIL_BACK_KEY, barKey: DETAIL_BACK_BAR_KEY, entryKey });
  useDetailSections(focus, input);

  const hadPlay = useRef(hasPlay);
  useEffect(() => {
    const target = detailEntryAfterPlayLost({ hadPlay: hadPlay.current, hasPlay, lastFocusedKey: focus.lastFocusedKey(), entryKey });
    hadPlay.current = hasPlay;
    return target ? focus.claim(target) : undefined;
  }, [hasPlay, entryKey, focus]);
}

function useDetailSections(focus: FocusStore, input: DetailFocusInput): void {
  const bound = useRef(false);
  if (!bound.current) {
    bound.current = true;
    for (const key of DETAIL_ROWS) focus.bind(key, ROW_EDGES);
  }
  const season = detailSeasonEntryKey(input.seasonIds, input.selectedSeasonId);
  const anchor = detailEpisodeAnchorKey(input.episodeCount, input.anchorIndex);
  const episode = useFirstVisitEntry(focus, { owns: isDetailEpisodeKey, anchorKey: anchor, resetKey: input.selectedSeasonId });
  useSectionEntry(focus, DETAIL_SEASONS_SECTION, season);
  useSectionEntry(focus, DETAIL_EPISODES_SECTION, episode);
}
