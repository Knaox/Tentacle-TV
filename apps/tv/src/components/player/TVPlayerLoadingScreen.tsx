import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, Spacing, Fonts, brandAlpha } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Barre de chargement — réplique de LoadingBar (web) : piste 3px white/12,
 * segment ¼ de largeur en dégradé transparent→brand→transparent qui glisse
 * de -100% à 400% (du segment) en 1.15s, en boucle.
 */
function TVLoadingBar() {
  const [barWidth, setBarWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1150, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false,
    );
  }, [progress]);

  const segmentStyle = useAnimatedStyle(() => {
    const segW = barWidth / 4;
    return {
      transform: [{ translateX: interpolate(progress.value, [0, 1], [-segW, barWidth]) }],
    };
  }, [barWidth]);

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={{
        height: 3, width: "100%", borderRadius: 2, overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.12)",
      }}
    >
      {barWidth > 0 && (
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: barWidth / 4 }, segmentStyle]}>
          <LinearGradient
            colors={["transparent", Colors.accentPurpleLight, "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: 2 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Écran de chargement du média — réplique de PlayerLoadingScreen (web) :
 * fond #0a0a12 + halo brand, backdrop en fade-in 500ms, scrim noir dégradé,
 * titre + sous-titre (S##E## — épisode) bas-gauche, barre de chargement animée.
 * `failed` : la résolution du flux a échoué → message + bouton « Réessayer »
 * (avant : la barre tournait pour toujours, sans erreur ni issue).
 */
export function TVPlayerLoadingScreen({ item, failed, onRetry }: {
  item?: MediaItem | null; failed?: boolean; onRetry?: () => void;
}) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const backdropOpacity = useSharedValue(0);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const isEpisode = item?.Type === "Episode";
  // Même fallback série que MediaDetailScreen (backdrop épisode rare)
  const hasParentBackdrop = isEpisode && ((item?.ParentBackdropImageTags?.length ?? 0) > 0);
  const backdropId = item
    ? (isEpisode
      ? (hasParentBackdrop ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id) : (item.SeriesId ?? item.Id))
      : item.Id)
    : null;
  const backdropUrl = backdropId ? client.getImageUrl(backdropId, "Backdrop", { width: 1280, quality: 80 }) : null;
  // Couche INSTANTANÉE : l'affiche Primary (même URL que les cartes → déjà en
  // cache image) floutée plein écran — la bannière est visible immédiatement,
  // le backdrop fond par-dessus quand son téléchargement aboutit.
  const posterId = item ? (isEpisode ? (item.SeriesId ?? item.Id) : item.Id) : null;
  const posterUrl = posterId ? client.getImageUrl(posterId, "Primary", { height: 360, quality: 85 }) : null;

  const title = isEpisode ? (item?.SeriesName ?? item?.Name) : item?.Name;
  const subtitle = isEpisode && item?.ParentIndexNumber != null && item?.IndexNumber != null
    ? `S${pad2(item.ParentIndexNumber)}E${pad2(item.IndexNumber)} — ${item.Name}`
    : null;

  return (
    <View pointerEvents={failed ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0a0a12", zIndex: 50, elevation: 50, overflow: "hidden" }]}>
      {/* Halo brand (équivalent du gradient radial web, visible avant le backdrop) */}
      <LinearGradient
        colors={[brandAlpha(0.20), "transparent"]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.75, y: 0.8 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Affiche floutée — visible immédiatement (cache image des cartes) */}
      {posterUrl && (
        <Image
          source={{ uri: posterUrl }}
          resizeMode="cover"
          blurRadius={14}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.55 }]}
        />
      )}
      {/* Backdrop — fade-in 500ms ease au chargement (animate-[fadeIn_0.5s_ease] web) */}
      {backdropUrl && (
        <Animated.Image
          source={{ uri: backdropUrl }}
          resizeMode="cover"
          style={[StyleSheet.absoluteFillObject, backdropStyle]}
          onLoad={() => {
            backdropOpacity.value = withTiming(1, { duration: 500, easing: Easing.ease });
          }}
        />
      )}
      {/* Scrim — from-black via-black/70 to-black/35 (bas → haut) */}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.7)", "#000"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Titre + sous-titre + barre, bas de l'écran */}
      <View style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        paddingHorizontal: Spacing.screenPadding, paddingBottom: 72,
      }}>
        {!!title && (
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 36, fontFamily: Fonts.bold, letterSpacing: -0.5, maxWidth: "75%" }}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, marginTop: 6, maxWidth: "75%" }}>
            {subtitle}
          </Text>
        )}
        <View style={{ marginTop: 24 }}>
          {failed ? (
            <View>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, marginBottom: 16 }}>
                {t("loadFailed")}
              </Text>
              <Focusable
                variant="button" focusRadius={Bouton.moyen.borderRadius} hasTVPreferredFocus onPress={onRetry}
                style={{ alignSelf: "flex-start", paddingHorizontal: 28, paddingVertical: 12, ...Bouton.moyen, backgroundColor: "rgba(255,255,255,0.14)" }}
              >
                <Text style={{ color: "#fff", fontSize: 17, fontFamily: Fonts.bold }}>
                  {t("retry")}
                </Text>
              </Focusable>
            </View>
          ) : (
            <TVLoadingBar />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Spinner discret de rebuffering en cours de lecture — réplique du spinner
 * web (anneau 48px, border 4 white/30 + top white, rotation continue),
 * sans fond noir plein.
 */
export function TVBufferingSpinner() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", zIndex: 50, elevation: 50 }]}>
      <Animated.View
        style={[{
          width: 48, height: 48, borderRadius: 24, borderWidth: 4,
          borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff",
        }, style]}
      />
    </View>
  );
}
