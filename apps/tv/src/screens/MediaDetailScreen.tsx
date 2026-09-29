import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, InteractionManager, findNodeHandle } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useItemTrailer, useMediaItem, useSimilarItems, useCollectionItems } from "@tentacle-tv/api-client";
import type { ExtraEntry, MediaItem, TrailerTarget } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { FocusableRow } from "../components/focus/FocusableRow";
import { TVPosterFrame, TVPosterMeta } from "../components/cards/TVPosterCard";
import { useTVCardActions } from "../components/cards/actions/useTVCardActions";
import { TVEpisodeList } from "../components/TVEpisodeList";
import { TVExtrasSection } from "../components/detail/TVExtrasSection";
import { TVCastCrew } from "../components/detail/TVCastCrew";
import { TVDetailHeader } from "../components/detail/TVDetailHeader";
import { TVSagaRow } from "../components/detail/TVSagaRow";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Colors, Spacing, CardConfig } from "../theme/colors";
import { SHOWS_VERTICAL_SCROLL_INDICATOR } from "../theme/focus";

type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

// Collection et titres similaires : l'affiche sous l'anneau, la légende dessous.
const renderPoster = (s: MediaItem, _i: number, focused: boolean) => (
  <TVPosterFrame item={s} width={CardConfig.portrait.width} focused={focused} />
);
const renderPosterMeta = (s: MediaItem) => <TVPosterMeta item={s} width={CardConfig.portrait.width} />;

export function MediaDetailScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation("common");
  const { itemId } = route.params;
  const queryClient = useQueryClient();
  const { data: item } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Le bouton « Bande-annonce » : la locale d'abord (lecteur), sinon la
  // distante (Jellyfin + TMDB, triées par langue du profil) — `useItemTrailer`.
  const trailer = useItemTrailer(item, i18n.language);
  // Collection (BoxSet) : contenu navigable (pas de lecture sur un conteneur)
  const isBoxSet = item?.Type === "BoxSet";
  const { data: collectionItems } = useCollectionItems(isBoxSet ? item?.Id : undefined);

  // Appui long sur une affiche (collection, titres similaires) → la feuille.
  const cardActions = useTVCardActions();

  const scrollRef = useRef<ScrollView>(null);
  const playBtnRef = useRef<View>(null);
  // Positions Y des sections épisodes/saga (relatives au contenu de page) :
  // leur focus fait défiler la PAGE — ces sections n'ont pas de scroll propre.
  const episodesY = useRef(0);
  const sagaY = useRef(0);
  // HAUT depuis une tuile extras → bouton Lecture : l'ancrage de page sur la
  // rangée sort les actions de l'écran, la cible géométrique n'existe plus.
  const [playHandle, setPlayHandle] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!item) return;
    const handle = findNodeHandle(playBtnRef.current);
    if (handle) setPlayHandle(handle);
  }, [item]);
  useTVRemote({ onBack: () => navigation.goBack() });

  // Re-focus play button + refresh data when screen comes back to foreground.
  // Invalidation différée après les interactions : ne pas concurrencer
  // l'animation d'entrée de l'écran (jank).
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        queryClient.invalidateQueries({ queryKey: ["item", itemId] });
      });
      // react-native-tvos #849 : repasser hasTVPreferredFocus à true alors qu'il
      // l'est déjà en prop est un NO-OP → le focus n'est pas re-saisi. Si le
      // focus a été perdu (ex. retour d'un player figé sans aucun focusable),
      // l'écran revenait sans focus → blocage. Cycle false→true pour forcer la
      // re-saisie de façon fiable.
      let innerTimer: ReturnType<typeof setTimeout> | undefined;
      const timer = setTimeout(() => {
        const node = playBtnRef.current as { setNativeProps?: (p: object) => void } | null;
        node?.setNativeProps?.({ hasTVPreferredFocus: false });
        innerTimer = setTimeout(() => node?.setNativeProps?.({ hasTVPreferredFocus: true }), 50);
      }, 150);
      return () => { task.cancel(); clearTimeout(timer); clearTimeout(innerTimer); };
    }, [queryClient, itemId])
  );

  const scrollToButtons = useCallback(() => {
    // Scroll to top area so buttons are visible within the backdrop zone
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Une bande-annonce ou un bonus LOCAL se lit dans le lecteur ; une vidéo
  // YouTube dans l'écran de bande-annonce (WebView Android, flux résolu tvOS).
  const openTrailer = useCallback((target: TrailerTarget) => {
    if (target.kind === "local") navigation.navigate("Player", { itemId: target.itemId });
    else navigation.navigate("Trailer", { url: target.trailer.Url, name: target.trailer.Name });
  }, [navigation]);
  const openExtra = useCallback((entry: ExtraEntry) => {
    openTrailer(entry.source === "local" ? { kind: "local", itemId: entry.itemId } : { kind: "remote", trailer: entry.trailer });
  }, [openTrailer]);
  const anchorExtras = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
  }, []);

  if (!item) return <View style={{ flex: 1, backgroundColor: Colors.bgDeep }} />;

  const isSeries = item.Type === "Series";

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: Colors.bgDeep }}
      contentContainerStyle={{ paddingBottom: 96 }}
      showsVerticalScrollIndicator={SHOWS_VERTICAL_SCROLL_INDICATOR}
    >
      <TVDetailHeader
        item={item}
        trailer={trailer}
        playBtnRef={playBtnRef}
        onPlay={(id) => navigation.navigate("Player", { itemId: id })}
        onTrailer={openTrailer}
        onSeriesPress={(seriesId) => navigation.push("MediaDetail", { itemId: seriesId })}
        onFocusButtons={scrollToButtons}
        onBack={() => navigation.goBack()}
      />

      {/* Collection (BoxSet) : contenu navigable */}
      {isBoxSet && collectionItems && collectionItems.length > 0 && (
        <FocusableRow
          title={t("collectionContent")}
          data={collectionItems}
          renderItem={renderPoster}
          renderBelow={renderPosterMeta}
          keyExtractor={(s) => s.Id}
          itemWidth={CardConfig.portrait.width}
          style={{ marginTop: Spacing.sectionGap }}
          onItemPress={(s: MediaItem) => navigation.push("MediaDetail", { itemId: s.Id })}
          onItemLongPress={cardActions.openPoster}
        />
      )}

      {/* Extras — bandes-annonces locales, bonus, vidéos distantes ; la série
          d'un épisode ; une rangée par saison qui en a. AU-DESSUS des
          saisons, comme le web. */}
      <TVExtrasSection
        item={item}
        parentSeries={isEpisode ? parentSeries : undefined}
        onOpen={openExtra}
        onFocusY={anchorExtras}
        firstNextFocusUp={playHandle}
      />

      {/* Episodes — série, ou série parente d'un épisode (fiche centrée épisode,
          saison présélectionnée + épisode surligné, comme le web) */}
      {(isSeries || (isEpisode && item.SeriesId != null)) && (
        <View
          style={{ marginTop: Spacing.sectionGap }}
          onLayout={(e) => { episodesY.current = e.nativeEvent.layout.y; }}
        >
          <TVEpisodeList
            seriesId={(isEpisode ? item.SeriesId : undefined) ?? item.Id}
            currentEpisodeId={isEpisode ? item.Id : undefined}
            initialSeasonId={isEpisode ? item.SeasonId : undefined}
            onPlay={(ep) => navigation.navigate("Player", { itemId: ep.Id })}
            onEpisodeFocus={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, episodesY.current + y - 100), animated: true })}
          />
        </View>
      )}

      {/* Distribution & équipe — non focusable, comme la LG (parité CastRow web) */}
      <View style={{ paddingHorizontal: TV_OVERSCAN_PT.x, marginTop: Spacing.sectionGap }}>
        <TVCastCrew item={item} />
      </View>

      {/* La saga d'un film (collection TMDB) : juste avant les similaires, comme
          sur le web. Son focus ancre la PAGE sur elle ; HAUT rend « Lecture ». */}
      {item.Type === "Movie" && (
        <TVSagaRow
          item={item}
          onOpen={(id) => navigation.push("MediaDetail", { itemId: id })}
          onLayout={(e) => { sagaY.current = e.nativeEvent.layout.y; }}
          onRowFocus={() => scrollRef.current?.scrollTo({ y: Math.max(0, sagaY.current - 60), animated: true })}
          cellNextFocusUp={playHandle}
          onLongPress={cardActions.openPoster}
        />
      )}

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <FocusableRow
          title={t("similarTitles")}
          data={similar}
          renderItem={renderPoster}
          renderBelow={renderPosterMeta}
          keyExtractor={(s) => s.Id}
          itemWidth={CardConfig.portrait.width}
          style={{ marginTop: Spacing.sectionGap }}
          onItemPress={(s: MediaItem) => navigation.push("MediaDetail", { itemId: s.Id })}
          onItemLongPress={cardActions.openPoster}
          onRowFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Une `Modal` : son contenu ne prend pas place dans la page. */}
      {cardActions.sheet}
    </ScrollView>
  );
}
