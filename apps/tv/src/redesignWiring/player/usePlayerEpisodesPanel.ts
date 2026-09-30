import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSeasonBrowser } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { Translate } from "../../redesign/screens/player/playerLabels";
import type { EpisodesPanelModel } from "../../redesign/screens/player/playerTypes";
import type { FocusStore } from "../focus/focusStore";
import type { ImageUrl } from "./playerArt";
import { buildEpisodesPanel } from "./playerPanelModels";

/** Focus maintenu sur une saison avant de la précharger : balayer la bande ne charge rien. */
const INTENT_MS = 200;
const SEASON_KEY = "episodes:season:";

/**
 * Le panneau « Épisodes » du lecteur, ouvert : la mécanique commune des
 * saisons (`useSeasonBrowser`, la même que la fiche et les autres
 * plateformes), projetée pour la vue — et son focus, comme le panneau actuel :
 * - à l'ouverture, l'épisode EN COURS prend le focus (la première ligne s'il
 *   n'est pas dans la saison affichée) ;
 * - choisir une saison mène à ses épisodes : sa ligne d'entrée prend le focus
 *   dès qu'elle est montée (réclamation du magasin, qui attend le montage) ;
 * - le focus qui s'attarde sur une saison la précharge.
 *
 * Fermé, il ne demande rien : les sources ne sont jamais chargées (la vue ne
 * montre pas de pastilles de qualité), et le lecteur a déjà préchargé saisons
 * et saison en cours (`useEpisodePanelPrefetch`).
 */
export function usePlayerEpisodesPanel(args: {
  item: MediaItem | null | undefined;
  open: boolean;
  store: FocusStore;
  image: ImageUrl;
  t: Translate;
  locale: string;
}): {
  model: EpisodesPanelModel | null;
  selectSeason: (seasonId: string) => void;
  episodeById: (id: string) => MediaItem | undefined;
  activeSeasonIndex: number;
} {
  const { item, open, store, image, t, locale } = args;
  const browser = useSeasonBrowser({
    seriesId: open ? item?.SeriesId : undefined,
    preferredSeasonId: item?.SeasonId,
    currentEpisodeSeasonId: item?.SeasonId,
    sources: false,
    // Une liste qui changerait sous le focus de la télécommande le perdrait.
    provisional: false,
  });
  const { seasons, episodes, selectedSeasonId, select, prefetch } = browser;

  // Chaque ouverture repart de la saison de l'épisode en cours, comme le
  // panneau actuel (qui naissait à l'ouverture) : le choix d'une ouverture
  // précédente ne survit pas à la fermeture.
  const seasonId = item?.SeasonId;
  useEffect(() => {
    if (open && seasonId) select(seasonId);
  }, [open, seasonId, select]);

  const model = useMemo(() => (open && item ? buildEpisodesPanel({
    seriesTitle: item.SeriesName ?? "",
    seasons,
    activeSeasonId: selectedSeasonId,
    currentSeasonId: item.SeasonId,
    episodes,
    currentEpisodeId: item.Id,
    loading: browser.episodesLoading,
    image,
    t,
    locale,
  }) : null), [open, item, seasons, selectedSeasonId, episodes, browser.episodesLoading, image, t, locale]);

  // L'entrée : l'épisode en cours s'il est dans la saison affichée, sinon la
  // première ligne — à l'ouverture, puis à chaque saison choisie.
  const current = episodes?.findIndex((episode) => episode.Id === item?.Id) ?? -1;
  const entryKey = open && episodes ? `episodes:episode:${Math.max(0, current)}` : null;
  useEffect(() => {
    if (!entryKey) return;
    return store.claim(entryKey);
  }, [store, entryKey, selectedSeasonId]);

  // Le focus qui s'attarde sur une saison la précharge (liste légère).
  const seasonsRef = useRef(seasons);
  seasonsRef.current = seasons;
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = store.subscribe((key, focused) => {
      if (!key.startsWith(SEASON_KEY)) return;
      clearTimeout(timer);
      const season = focused ? seasonsRef.current?.[Number(key.slice(SEASON_KEY.length))] : undefined;
      if (season) timer = setTimeout(() => prefetch(season.Id), INTENT_MS);
    });
    return () => { stop(); clearTimeout(timer); };
  }, [open, store, prefetch]);

  const episodeById = useCallback((id: string) => episodes?.find((episode) => episode.Id === id), [episodes]);
  const activeSeasonIndex = Math.max(0, seasons?.findIndex((season) => season.Id === selectedSeasonId) ?? 0);
  return { model, selectSeason: select, episodeById, activeSeasonIndex };
}
