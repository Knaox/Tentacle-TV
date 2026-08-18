import { useEffect } from "react";
import { View, Text, Image, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem, RichTrailer } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { TV_DETAIL_BANNER, TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { Focusable } from "../focus/Focusable";
import { TVMetaChips } from "../TVMetaChips";
import { TVDetailActions } from "./TVDetailActions";
import { TVDetailPoster } from "./TVDetailPoster";
import { Colors, Spacing, Typography, Radius } from "../../theme/colors";

interface TVDetailHeaderProps {
  item: MediaItem;
  trailers: RichTrailer[];
  playBtnRef: React.RefObject<View | null>;
  onPlay: (itemId: string) => void;
  onTrailer: (trailer: RichTrailer) => void;
  onSeriesPress: (seriesId: string) => void;
  onFocusButtons: () => void;
}

/**
 * L'en-tête de la fiche : backdrop PLEIN CADRE (contrairement à l'accueil, la
 * bannière d'une fiche EST le fond de l'écran — `TV_DETAIL_BANNER`, hauteur
 * 58 vh + 260 comme la LG), puis la rangée affiche + informations posée sur
 * l'image, avec la cascade d'apparition. Extrait de `MediaDetailScreen` pour
 * le budget de 300 lignes.
 */
export function TVDetailHeader({
  item,
  trailers,
  playBtnRef,
  onPlay,
  onTrailer,
  onSeriesPress,
  onFocusButtons,
}: TVDetailHeaderProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const backdropH = Math.round((screenH * TV_DETAIL_BANNER.hauteurVh) / 100) + TV_DETAIL_BANNER.supplementPx;
  // Le bloc d'informations commence à ~32 % de l'écran : posé SUR l'image,
  // assez haut pour que les actions restent visibles sans défiler.
  const contentTop = Math.round(screenH * 0.32);

  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const hasParentBackdrop = isEpisode && (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const backdropId = isEpisode
    ? (hasParentBackdrop ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id) : item.Id)
    : item.Id;
  const backdrop = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : null;

  // Cascade entry animations
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const synopsisAnim = useSharedValue(0);
  const buttonsAnim = useSharedValue(0);

  useEffect(() => {
    titleAnim.value = withDelay(100, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    metaAnim.value = withDelay(200, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    synopsisAnim.value = withDelay(300, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    buttonsAnim.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [titleAnim, metaAnim, synopsisAnim, buttonsAnim]);

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

  return (
    <>
      {/* Backdrop plein cadre */}
      <View style={{ width: screenW, height: backdropH }}>
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
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: screenW * 0.5 }}
        />
      </View>

      {/* Rangée affiche + informations, posée sur l'image */}
      <View
        style={{
          paddingHorizontal: TV_OVERSCAN_PT.x,
          marginTop: contentTop - backdropH,
          flexDirection: "row",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        <TVDetailPoster item={item} />

        <View style={{ flex: 1 }}>
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
                onPress={() => onSeriesPress(item.SeriesId!)}
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

          {/* Méta qualité/langues complète (4K · Dolby Vision · Atmos · VF…) */}
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

          {/* Synopsis — clampé à 3 lignes comme le web */}
          {item.Overview && (
            <Animated.View style={[{ marginTop: Spacing.metaToSynopsis, maxWidth: screenW * 0.55 }, synopsisStyle]}>
              <Text numberOfLines={3} style={{ color: Colors.textSecondary, ...Typography.synopsis, lineHeight: 26 }}>
                {item.Overview}
              </Text>
            </Animated.View>
          )}

          {/* Actions : Lecture · Bande-annonce · Favori · Ma liste · Vu */}
          <Animated.View style={[{ flexDirection: "row", marginTop: Spacing.synopsisToButtons }, buttonsStyle]}>
            <TVDetailActions
              item={item}
              trailers={trailers}
              playBtnRef={playBtnRef}
              onPlay={onPlay}
              onTrailer={onTrailer}
              onFocusButtons={onFocusButtons}
            />
          </Animated.View>
        </View>
      </View>
    </>
  );
}
