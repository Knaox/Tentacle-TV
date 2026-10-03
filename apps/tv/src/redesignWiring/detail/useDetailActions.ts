import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useResolvePlayTarget } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { detailPlayPress, holdPanelOf, sagaEntryPress, type HoldPanel } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import type { DetailCallbacks } from "../../redesign/screens/detail/detailTypes";
import { showNotice } from "../overlays/transientNotice";
import type { TitleRequests } from "../vigie/useTitleRequests";
import type { DetailModel } from "./useDetailModel";
import { useOpenDetail } from "./useOpenDetail";

/**
 * Les gestes de la fiche refondue — ceux de la fiche actuelle ; où mène OK
 * est la règle de tv-core (`nav/screenTargets.ts`, FI-10) :
 * - Lecture : l'item ; pour une série, l'épisode résolu (jamais l'identifiant
 *   de la série), au geste s'il se résout encore (`detailPlayPress`) ;
 * - bande-annonce et extras : une vidéo LOCALE dans le lecteur, une vidéo
 *   YouTube dans l'écran de bande-annonce ;
 * - une personne ouvre sa filmographie, une carte sa fiche, l'appui long la
 *   feuille d'actions que dit la règle de T6 (`holdPanelOf` : vignette pour
 *   un épisode, affiche sinon, panneau d'un titre absent) — la page ouverte
 *   REMPLACE la fiche (`useOpenDetail`, la suite de fiches) ;
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
  /** Le geste « demander » d'un volet absent ; `null` : garde Vigie fermée. */
  requests: TitleRequests | null;
}

export function useDetailActions(input: DetailActionsInput): DetailCallbacks {
  const navigation = useNavigation<Navigation>();
  const resolvePlay = useResolvePlayTarget();
  const { t } = useTranslation();
  const open = useOpenDetail();
  const latest = useRef({ ...input, navigation, resolvePlay, t, open });
  latest.current = { ...input, navigation, resolvePlay, t, open };
  const hasSeries = input.model.item?.Type === "Episode" && !!input.model.item.SeriesId;

  return useMemo<DetailCallbacks>(() => {
    const nav = () => latest.current.navigation;
    const model = () => latest.current.model;
    const play = (itemId: string) => nav().navigate("Player", { itemId });
    // Le panneau d'un titre de la bibliothèque, dans la variante que dit la règle.
    const openPanel = (panel: HoldPanel | null, item: MediaItem | undefined) => {
      if (!item || panel?.kind !== "media") return;
      if (panel.variant === "landscape") latest.current.openLandscapeSheet(item);
      else latest.current.openPosterSheet(item);
    };
    return {
      onPlay: () => {
        const { item, watch } = model();
        if (!item) return;
        const press = detailPlayPress(
          { id: item.Id, isSeries: item.Type === "Series" },
          watch ? (watch.type === "completed" ? { completed: true } : { completed: false, episodeId: watch.episode.Id }) : undefined,
        );
        if (press.kind === "play") return play(press.itemId);
        if (press.kind === "none") return;
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
            if (seriesId) latest.current.open.openTitle({ Id: seriesId });
          }
        : undefined,
      onSelectSeason: (seasonId) => model().episodes.select(seasonId),
      onFocusSeason: (seasonId) => model().episodes.prefetch(seasonId),
      onPlayEpisode: (episode) => play(episode.id),
      onLongPressEpisode: (episode) => openPanel(holdPanelOf({ surface: "detail", card: "episode" }), model().episodes.episodeOf(episode.id)),
      onOpenPerson: (person) => latest.current.open.openPerson(person),
      onOpenExtra: (extra) => {
        const { item, extras } = model();
        const entry = extras.entryOf(extra.id);
        if (!entry) return;
        if (entry.source === "local") play(entry.itemId);
        else nav().navigate("Trailer", { url: entry.trailer.Url, name: entry.title, itemId: item?.Id });
      },
      onOpenSagaEntry: (entry) => {
        // Un volet absent n'a pas de fiche : le demander quand le serveur le
        // permet, sinon dire pourquoi rien ne s'ouvre (`sagaEntryPress`).
        const { requests, model: current, t } = latest.current;
        const absent = !!entry.card.absent;
        const title = absent && !entry.current ? current.cards.absentOf(entry.key) : undefined;
        const press = sagaEntryPress({ current: !!entry.current, absent, canRequest: !!requests && !!title });
        if (press === "open") return latest.current.open.openTitle(latest.current.cardItemOf(entry.card.id) ?? { Id: entry.card.id });
        if (press === "request" && requests && title) return requests.open(title);
        if (press === "notInLibrary") showNotice({ kind: "info", title: t("cards:notInLibraryNotice") });
      },
      onLongPressSagaEntry: (entry) => {
        const { requests, model: current, cardItemOf } = latest.current;
        const title = entry.card.absent ? current.cards.absentOf(entry.key) : undefined;
        const card = entry.card.absent ? "sagaAbsent" : "sagaPresent";
        const panel = holdPanelOf({ surface: "detail", card, requestable: !!requests && !!title });
        if (panel?.kind === "absent") return title ? requests?.hold(title) : undefined;
        openPanel(panel, cardItemOf(entry.card.id));
      },
      onOpenCard: (_section, card) => latest.current.open.openTitle(latest.current.cardItemOf(card.id) ?? { Id: card.id }),
      // La collection et les similaires : des affiches de la bibliothèque.
      onLongPressCard: (card) => openPanel(holdPanelOf({ surface: "detail", card: "similar" }), latest.current.cardItemOf(card.id)),
      onRetry: () => model().refetch(),
      onBack: () => nav().goBack(),
    };
  }, [hasSeries]);
}
