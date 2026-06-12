import { useEffect, useRef, useCallback } from "react";
import { View, Text, Image, ScrollView, Dimensions, InteractionManager } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaItem, useSimilarItems, useCollectionItems, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { FocusableRow } from "../components/focus/FocusableRow";
import { TVPosterCard } from "../components/cards/TVPosterCard";
import { TVEpisodeList } from "../components/TVEpisodeList";
import { TVExtrasRow } from "../components/detail/TVExtrasRow";
import { TVMetaChips } from "../components/TVMetaChips";
import { TVDetailActions } from "../components/detail/TVDetailActions";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { useTvTrailers } from "../hooks/useTvTrailers";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

export function MediaDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation("common");
  const { itemId } = route.params;
  const queryClient = useQueryClient();
  const client = useJellyfinClient();
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
      const timer = setTimeout(() => {
        // @ts-ignore setNativeProps exists on react-native-tvos
        playBtnRef.current?.setNativeProps({ hasTVPreferredFocus: true });
      }, 150);
      return () => { task.cancel(); clearTimeout(timer); };
    }, [queryClient, itemId])
  );

  const scrollToButtons = useCallback(() => {
    // Scroll to top area so buttons are visible within the backdrop zone
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Cascade entry animations
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const synopsisAnim = useSharedValue(0);
  const buttonsAnim = useSharedValue(0);

  useEffect(() => {
    if (!item) return;
    titleAnim.value = withDelay(100, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    metaAnim.value = withDelay(200, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    synopsisAnim.value = withDelay(300, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    buttonsAnim.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [item, titleAnim, metaAnim, synopsisAnim, buttonsAnim]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleAnim.value,
    transform: [{ translateX: (1 - titleAnim.value) * -30 }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaAnim.value,
    transform: [{ translateX: (1 - metaAnim.value) * -20 }],
  }));
  const synopsisStyle = useAnimatedStyle(() => ({
    opacity: synopsisAnim.value,
    transform: [{ translateX: (1 - synopsisAnim.value) * -20 }],
  }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsAnim.value,
    transform: [{ translateY: (1 - buttonsAnim.value) * 20 }],
  }));

  if (!item) return <View style={{ flex: 1, backgroundColor: Colors.bgDeep }} />;

  const hasParentBackdrop = isEpisode && (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const backdropId = isEpisode
    ? (hasParentBackdrop ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id) : item.Id)
    : item.Id;
  const backdrop = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
  const isSeries = item.Type === "Series";
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : null;


  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: Colors.bgDeep }} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Full-screen backdrop */}
      <View style={{ width: SCREEN_W, height: SCREEN_H * 0.6 }}>
        <Image
          source={{ uri: backdrop }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)", Colors.bgDeep]}
          locations={[0, 0.5, 1]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "70%" }}
        />
        <LinearGradient
          colors={[Colors.bgDeep, "rgba(0,0,0,0.7)", "transparent"]}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: SCREEN_W * 0.5 }}
        />
      </View>

      {/* Content zone — remonté pour que les boutons d'action restent
          visibles malgré chips qualité + genres + synopsis */}
      <View style={{
        paddingHorizontal: Spacing.screenPadding,
        marginTop: -Math.round(SCREEN_H * 0.28),
      }}>
        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={{ color: Colors.textPrimary, ...Typography.detailTitle }}>
            {item.Name}
          </Text>
        </Animated.View>

        {/* Fiche épisode : lien vers la fiche série (parité web « SeriesName — S#E# › ») */}
        {isEpisode && item.SeriesName && item.SeriesId && (
          <Animated.View style={[{ alignSelf: "flex-start", marginTop: 8 }, metaStyle]}>
            <Focusable
              variant="button"
              onPress={() => navigation.push("MediaDetail", { itemId: item.SeriesId! })}
              accessibilityLabel={item.SeriesName}
            >
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 8,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: Radius.buttonLarge,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>
                  {item.SeriesName}
                  {item.ParentIndexNumber != null && item.IndexNumber != null
                    ? ` — S${item.ParentIndexNumber}E${item.IndexNumber}`
                    : ""}
                  {"  ›"}
                </Text>
              </View>
            </Focusable>
          </Animated.View>
        )}

        {/* Metadata */}
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: Spacing.titleToMeta }, metaStyle]}>
          {year && <Text style={{ color: Colors.textSecondary, ...Typography.meta }}>{year}</Text>}
          {rating && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.ratingGold, ...Typography.meta }}>★ {rating}</Text>
            </>
          )}
          {runtime && !isSeries && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>{runtime}</Text>
            </>
          )}
          {isSeries && item.ChildCount && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>
                {item.ChildCount} {t("seasons")}
              </Text>
            </>
          )}
        </Animated.View>

        {/* Méta qualité/langues complète (4K · Dolby Vision · Atmos · VF…) —
            identique à DetailMetadata du desktop */}
        <Animated.View style={[{ marginTop: 12 }, metaStyle]}>
          <TVMetaChips item={item} />
        </Animated.View>

        {/* Genre pills */}
        <Animated.View style={[{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }, metaStyle]}>
          {item.Genres?.map((g) => (
            <View key={g} style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 14 }}>{g}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Synopsis — clampé à 3 lignes comme le web (sinon le bloc pousse
            les boutons d'action hors écran) */}
        {item.Overview && (
          <Animated.View style={[{ marginTop: Spacing.metaToSynopsis, maxWidth: SCREEN_W * 0.55 }, synopsisStyle]}>
            <Text numberOfLines={3} style={{ color: Colors.textSecondary, ...Typography.synopsis, lineHeight: 26 }}>
              {item.Overview}
            </Text>
          </Animated.View>
        )}

        {/* Buttons — CTA blanc façon web/Netflix + bande-annonce + Ma liste.
            Série : épisode résolu via watch state (jamais l'ID série). */}
        <Animated.View style={[{ flexDirection: "row", gap: Spacing.buttonGap, marginTop: Spacing.synopsisToButtons }, buttonsStyle]}>
          <TVDetailActions
            item={item}
            trailers={trailers}
            playBtnRef={playBtnRef}
            onPlay={(id) => navigation.navigate("Player", { itemId: id })}
            onTrailer={(tr) => navigation.navigate("Trailer", { url: tr.Url, name: tr.Name })}
            onFocusButtons={scrollToButtons}
          />
        </Animated.View>
      </View>

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
