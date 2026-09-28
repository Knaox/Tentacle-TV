import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, resolvePosterImage } from "@tentacle-tv/shared";
import { useResilientImage } from "@/hooks/useResilientImage";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar } from "@/components/ui";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useCardWidth } from "@/contexts/CardDensityContext";
import { useSeriesRatingMap } from "@/contexts/SeriesRatingContext";
import { CardMarkerLayer } from "@/components/cards/CardMarkerLayer";
import { cardProgress } from "@/components/cards/cardProgress";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { posterSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { ENABLE_SHARED_POSTER_TRANSITION } from "@/constants/featureFlags";

interface Props {
  item: MediaItem;
  onPress: () => void;
  /**
   * L'appui long. Absent : la feuille d'appui long de la portée (variante
   * `poster`) — toute affiche de la bibliothèque l'ouvre, sans qu'on ait à
   * la faire descendre de rangée en rangée. Une collection en sélection
   * multiple passe le sien.
   */
  onLongPress?: () => void;
  width?: number;
}

/**
 * Card poster 2:3 Netflix-style — radius 12, fallback letter cinematic,
 * progress bar violet en bas, marqueurs d'état façon Crunchyroll
 * (`CardMarkerLayer`), scale spring sur press (via PressableCard). Title Inter
 * semibold, sous-titre tertiary. Son appui long ouvre la feuille des cartes
 * (`MediaActionSheet`), variante `poster`.
 */
export const MobileMediaCard = memo(function MobileMediaCard({
  item, onPress, onLongPress, width,
}: Props) {
  const client = useJellyfinClient();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  // Rails : la largeur du compte (densité) ; une `width` explicite (grilles)
  // l'emporte toujours. Le hook est appelé sans condition.
  const contextWidth = useCardWidth();
  const cardWidth = width ?? contextWidth;
  const { t } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  // Tuile série synthétique des « Derniers ajouts » (groupLatestByRuns) :
  // Id = SeriesId, sans ImageTags — le poster série existe côté Jellyfin.
  const addedCount = item.RecentlyAddedCount ?? 0;
  const isGroupedSeries = addedCount > 1;
  // La chaîne de repli est celle du web et de la TV (`cardImage` partagé) :
  // affiche de l'épisode, puis de la série, avec son `tag` — sans lui l'URL
  // est immuable, et une affiche apparue après un 404 resterait grise à vie.
  const resolved = resolvePosterImage(item, "series");
  const posterId = resolved?.id ?? item.Id;
  const poster = resolved
    ? client.getImageUrl(resolved.id, resolved.type, {
        width: 300,
        quality: 80,
        ...(resolved.tag ? { tag: resolved.tag } : {}),
      })
    : null;
  const image = useResilientImage(poster);
  const progress = cardProgress(item);
  // Cette affiche montre le visage d'une SÉRIE (même chaîne de repli d'image
  // que le web) : elle en porte donc la note, lot « +N » comme épisode isolé.
  const { rating } = cardRatingFor(item, "series", useSeriesRatingMap());
  const openSheet = useCardSheetOpener();
  const handleLongPress = onLongPress ?? (openSheet ? () => openSheet(posterSheetTarget(item)) : undefined);
  const posterUri = image.uri;

  return (
    <PressableCard
      onPress={onPress}
      onLongPress={handleLongPress}
      style={{ width: cardWidth }}
      accessibilityRole="button"
      accessibilityLabel={`${item.Name}${item.ProductionYear ? `, ${item.ProductionYear}` : ""}${progress !== null ? `, ${Math.round(progress)}%` : ""}${isGroupedSeries ? `, ${t("addedEpisodes", { count: addedCount })}` : ""}`}
    >
      <View style={st.poster}>
        {/* Inner clip — sépare le clipping de l'image du shadow du poster (sinon l'image déborde légèrement les coins arrondis sur certains renders). */}
        <View style={st.imageClip} pointerEvents="none">
          {posterUri === null ? (
            <View style={st.fallback}>
              <Text style={st.fallbackLetter}>{item.Name?.charAt(0).toUpperCase() ?? "?"}</Text>
            </View>
          ) : ENABLE_SHARED_POSTER_TRANSITION ? (
            <Animated.Image
              source={{ uri: posterUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={image.onError}
              sharedTransitionTag={`poster-${posterId}`}
            />
          ) : (
            <Image
              source={{ uri: posterUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={image.onError}
              transition={250}
              recyclingKey={posterUri}
            />
          )}
        </View>
        {progress !== null && (
          <View style={st.progWrap}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
        {/* Marqueurs du repos — modèle partagé par toutes les plateformes :
            note (globale + la vôtre) en bas à gauche, pastille d'états (ma
            liste, favori, vu) en haut à droite. La note remonte au-dessus de
            la barre de progression quand il y en a une : les deux se
            chevauchaient au même bord. */}
        <CardMarkerLayer item={item} communityRating={rating} liftRating={progress !== null} />
        {isGroupedSeries && (
          // Badge "+N" violet→rose top-left — match desktop PosterCard.tsx:81
          // (from-[var(--brand)] to-[var(--brand-accent)]) : le rose est
          // désormais un vrai token de palette, il suit thème et admin.
          <LinearGradient
            colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.countBadge}
          >
            <Text style={st.countBadgeText}>+{addedCount}</Text>
          </LinearGradient>
        )}
      </View>
      <Text numberOfLines={1} style={st.title}>
        {isEpisode && item.IndexNumber != null
          ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
          : ""}{item.Name}
      </Text>
      {isGroupedSeries && <Text style={st.year}>{t("addedEpisodes", { count: addedCount })}</Text>}
      {!isGroupedSeries && !isEpisode && item.ProductionYear != null && <Text style={st.year}>{item.ProductionYear}</Text>}
      {isEpisode && item.SeriesName != null && <Text numberOfLines={1} style={st.year}>{item.SeriesName}</Text>}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: RADIUS.lg,
    backgroundColor: t.colors.surface.s2,
    ...SHADOW_RN.elev2,
  },
  imageClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: t.colors.surface.s2,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface.s2,
  },
  fallbackLetter: {
    fontSize: 36,
    fontFamily: FONT_FAMILY.extrabold,
    color: t.colors.text.disabled,
    letterSpacing: -0.5,
  },
  progWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  countBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    shadowColor: t.colors.brand.violet,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  countBadgeText: {
    fontSize: 11,
    lineHeight: 12,
    fontFamily: FONT_FAMILY.bold,
    color: t.colors.cta.brandFg,
  },
  title: {
    ...typography.small,
    fontSize: 13,
    fontFamily: FONT_FAMILY.semibold,
    color: t.colors.text.primary,
    marginTop: 8,
    letterSpacing: -0.1,
  },
  year: {
    ...typography.badge,
    fontFamily: FONT_FAMILY.medium,
    color: t.colors.text.tertiary,
    marginTop: 2,
  },
});
