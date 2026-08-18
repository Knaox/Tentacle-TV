import { useCallback, useRef } from "react";
import { View, ScrollView, InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaItem, useSimilarItems, useCollectionItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { FocusableRow } from "../components/focus/FocusableRow";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { TVEpisodeList } from "../components/TVEpisodeList";
import { TVExtrasRow } from "../components/detail/TVExtrasRow";
import { TVCastCrew } from "../components/detail/TVCastCrew";
import { TVDetailHeader } from "../components/detail/TVDetailHeader";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTvTrailers } from "../hooks/useTvTrailers";
import { Colors, Spacing, CardConfig } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

export function MediaDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation("common");
  const { itemId } = route.params;
  const queryClient = useQueryClient();
  const { data: item } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Bandes-annonces Jellyfin + TMDB, triées par langue du profil (DB Tentacle)
  const trailers = useTvTrailers(item);
  // Collection (BoxSet) : contenu navigable (pas de lecture sur un conteneur)
  const isBoxSet = item?.Type === "BoxSet";
  const { data: collectionItems } = useCollectionItems(isBoxSet ? item?.Id : undefined);

  const scrollRef = useRef<ScrollView>(null);
  const playBtnRef = useRef<View>(null);
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

  if (!item) return <View style={{ flex: 1, backgroundColor: Colors.bgDeep }} />;

  const isSeries = item.Type === "Series";

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: Colors.bgDeep }}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      <TVDetailHeader
        item={item}
        trailers={trailers}
        playBtnRef={playBtnRef}
        onPlay={(id) => navigation.navigate("Player", { itemId: id })}
        onTrailer={(tr) => navigation.navigate("Trailer", { url: tr.Url, name: tr.Name })}
        onSeriesPress={(seriesId) => navigation.push("MediaDetail", { itemId: seriesId })}
        onFocusButtons={scrollToButtons}
      />

      {/* Collection (BoxSet) : contenu navigable */}
      {isBoxSet && collectionItems && collectionItems.length > 0 && (
        <FocusableRow
          title={t("collectionContent", { defaultValue: "Contenu de la collection" })}
          data={collectionItems}
          renderItem={(s: MediaItem, _i: number, focused: boolean) => <TVPosterCard item={s} focused={focused} />}
          keyExtractor={(s) => s.Id}
          itemWidth={CardConfig.portrait.width}
          style={{ marginTop: Spacing.sectionGap }}
          onItemPress={(s: MediaItem) => navigation.push("MediaDetail", { itemId: s.Id })}
        />
      )}

      {/* Extras (bandes-annonces + teasers) — AU-DESSUS des saisons, comme le web */}
      {trailers.length > 0 && (
        <TVExtrasRow
          trailers={trailers}
          onSelect={(tr) => navigation.navigate("Trailer", { url: tr.Url, name: tr.Name })}
          style={{ marginTop: Spacing.sectionGap }}
        />
      )}

      {/* Episodes — série, ou série parente d'un épisode (fiche centrée épisode,
          saison présélectionnée + épisode surligné, comme le web) */}
      {(isSeries || (isEpisode && item.SeriesId)) && (
        <View style={{ marginTop: Spacing.sectionGap }}>
          <TVEpisodeList
            seriesId={isEpisode ? item.SeriesId! : item.Id}
            currentEpisodeId={isEpisode ? item.Id : undefined}
            initialSeasonId={isEpisode ? item.SeasonId : undefined}
            onPlay={(ep) => navigation.navigate("Player", { itemId: ep.Id })}
          />
        </View>
      )}

      {/* Distribution & équipe — non focusable, comme la LG (parité CastRow web) */}
      <View style={{ paddingHorizontal: TV_OVERSCAN_PT.x, marginTop: Spacing.sectionGap }}>
        <TVCastCrew item={item} />
      </View>

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <FocusableRow
          title={t("similarTitles")}
          data={similar}
          renderItem={(s: MediaItem, _i: number, focused: boolean) => <TVPosterCard item={s} focused={focused} />}
          keyExtractor={(s) => s.Id}
          itemWidth={CardConfig.portrait.width}
          style={{ marginTop: Spacing.sectionGap }}
          onItemPress={(s: MediaItem) => navigation.push("MediaDetail", { itemId: s.Id })}
          onRowFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
        />
      )}
    </ScrollView>
  );
}
