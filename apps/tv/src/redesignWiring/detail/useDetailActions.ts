import { useMemo, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { RootStackParamList } from "../../navigation/types";
import type { DetailCallbacks } from "../../redesign/screens/detail/detailTypes";
import type { DetailModel } from "./useDetailModel";

/**
 * Les gestes de la fiche refondue — ceux de la fiche actuelle :
 * - Lecture : l'item ; pour une série, l'épisode résolu (jamais l'identifiant
 *   de la série), au geste s'il se résout encore ;
 * - bande-annonce et extras : une vidéo LOCALE dans le lecteur, une vidéo
 *   YouTube dans l'écran de bande-annonce ;
 * - une personne ouvre sa filmographie, une carte sa fiche, l'appui long la
 *   feuille d'actions (vignette pour un épisode, affiche sinon) ;
 * - « Noter » ouvre la feuille réduite à la note.
 *
 * Tous STABLES : ils lisent le dernier état au moment du geste. La vue et ses
 * sections sont mémoïsées ; des rappels neufs à chaque rendu (les bascules de
 * `useCardToggles` le sont) redessineraient chaque vignette d'épisode.
 */

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export interface DetailActionsInput {
  model: DetailModel;
  openLandscapeSheet: (item: MediaItem) => void;
  openPosterSheet: (item: MediaItem) => void;
  openRating: () => void;
  /** L'item Jellyfin d'une carte de la fiche (collection, similaires, saga). */
  cardItemOf: (cardId: string) => MediaItem | undefined;
}

export function useDetailActions(input: DetailActionsInput): DetailCallbacks {
  const navigation = useNavigation<Navigation>();
  const resolvePlay = useResolvePlayTarget();
  const latest = useRef({ ...input, navigation, resolvePlay });
  latest.current = { ...input, navigation, resolvePlay };
  const hasSeries = input.model.item?.Type === "Episode" && !!input.model.item.SeriesId;

  return useMemo<DetailCallbacks>(() => {
    const nav = () => latest.current.navigation;
    const model = () => latest.current.model;
    const play = (itemId: string) => nav().navigate("Player", { itemId });
    return {
      onPlay: () => {
        const { item, watch } = model();
        if (!item) return;
        if (item.Type !== "Series") return play(item.Id);
        if (watch) {
          if (watch.type !== "completed") play(watch.episode.Id);
          return;
        }
        // L'état de visionnage se résout encore : le geste le résout, sur la même clé.
        void latest.current.resolvePlay(item).then((itemId) => {
          if (itemId) play(itemId);
        });
      },
      onTrailer: () => {
        const { item, trailer } = model();
        const target = trailer.target;
        if (!target) return;
        if (target.kind === "local") play(target.itemId);
        else nav().navigate("Trailer", { url: target.trailer.Url, name: target.trailer.Name, itemId: item?.Id });
      },
      onToggleWatchlist: () => model().toggles.toggleList(),
      onToggleFavorite: () => model().toggles.toggleFavorite(),
      onToggleWatched: () => model().toggles.toggleWatched(),
      onRate: () => latest.current.openRating(),
      onOpenSeries: hasSeries
        ? () => {
            const seriesId = model().item?.SeriesId;
            if (seriesId) nav().push("MediaDetail", { itemId: seriesId });
          }
        : undefined,
      onSelectSeason: (seasonId) => model().episodes.select(seasonId),
      onFocusSeason: (seasonId) => model().episodes.prefetch(seasonId),
      onPlayEpisode: (episode) => play(episode.id),
      onLongPressEpisode: (episode) => {
        const found = model().episodes.episodeOf(episode.id);
        if (found) latest.current.openLandscapeSheet(found);
      },
      onOpenPerson: (person) => nav().push("SearchBrowse", { kind: "person", id: person.id, name: person.name }),
      onOpenExtra: (extra) => {
        const { item, extras } = model();
        const entry = extras.entryOf(extra.id);
        if (!entry) return;
        if (entry.source === "local") play(entry.itemId);
        else nav().navigate("Trailer", { url: entry.trailer.Url, name: entry.title, itemId: item?.Id });
      },
      onOpenSagaEntry: (entry) => {
        if (entry.card && !entry.current) nav().push("MediaDetail", { itemId: entry.card.id });
      },
      onOpenCard: (_section, card) => nav().push("MediaDetail", { itemId: card.id }),
      onLongPressCard: (card) => {
        const found = latest.current.cardItemOf(card.id);
        if (found) latest.current.openPosterSheet(found);
      },
      onRetry: () => model().refetch(),
      onBack: () => nav().goBack(),
    };
  }, [hasSeries]);
}
