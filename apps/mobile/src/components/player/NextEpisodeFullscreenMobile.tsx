import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { X, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { EndCardRating } from "@tentacle-tv/api-client";
import { PLAYER, motion, useResponsive } from "../../theme";
import { StarRatingMobile } from "../rating/StarRatingMobile";
import { OverlayPill } from "./overlayPill";
import { useArmedCountdown } from "./useArmedCountdown";

interface Props {
  nextEpisode: MediaItem;
  /** Secondes restantes ; `null` = affiche sans minuterie (auto-play coupé). */
  countdownSeconds: number | null;
  countdownTotalMs: number;
  onPlay: () => void;
  /** Refuser l'affiche — l'arbitre sort du lecteur (retour à la fiche). */
  onDismiss: () => void;
  /** Notation de l'épisode qu'on VIENT de finir — absente : rendu inchangé. */
  rating?: EndCardRating | null;
  /** Appelé quand une note se pose : tue le décompte de la suite. */
  onRatingEngage?: () => void;
}

/** Repli sans bannière — le dégradé du cadre d'aperçu des réglages desktop. */
const FALLBACK_COLORS = ["#2b2436", "#16131c", "#0a0a0d"] as const;

/**
 * L'affiche de fin PLEIN ÉCRAN — le portage du `NextEpisodeFullscreen`
 * desktop. Elle ne paraît qu'à la vraie fin (`overlay.final`) : le fond est la
 * bannière de la SÉRIE qui dézoome lentement, deux voiles la laissent
 * respirer, et le panneau bas-gauche porte vignette, titre, synopsis et la
 * même pilule blanche que partout — dont le balayage REPREND la course
 * entamée par la carte de coin (`initialProgress`), jamais de zéro.
 */
export function NextEpisodeFullscreenMobile({
  nextEpisode, countdownSeconds, countdownTotalMs, onPlay, onDismiss, rating, onRatingEngage,
}: Props) {
  const { t } = useTranslation("player");
  const { t: tReco } = useTranslation("reco");
  const client = useJellyfinClient();
  const insets = useSafeAreaInsets();
  const { width, isTablet } = useResponsive();
  const reduced = motion.isReducedMotion();

  // Fondu d'entrée + dézoom 1.06 → 1 sur huit secondes (parité desktop).
  const fade = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const zoom = useRef(new Animated.Value(reduced ? 1 : 1.06)).current;
  const panel = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const animations = [
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 8000, useNativeDriver: true }),
      Animated.timing(panel, { toValue: 1, duration: 350, delay: 80, useNativeDriver: true }),
    ];
    animations.forEach((a) => a.start());
    return () => { animations.forEach((a) => a.stop()); };
  }, [fade, zoom, panel, reduced]);

  const armed = useArmedCountdown(countdownSeconds, countdownTotalMs);

  const isEpisode = nextEpisode.Type === "Episode";
  const seriesId = isEpisode
    ? (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id)
    : nextEpisode.Id;
  const backdropUrl = client.getImageUrl(seriesId, "Backdrop", { width: 1280, quality: 80 });
  const thumbUrl = client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 85 });
  const episodeLabel = isEpisode && nextEpisode.ParentIndexNumber != null && nextEpisode.IndexNumber != null
    ? `S${String(nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(nextEpisode.IndexNumber).padStart(2, "0")}`
    : null;

  // Paysage large : vignette + colonne texte côte à côte ; portrait : colonne.
  const row = width >= 640;
  const sidePad = Math.max(insets.left, 24);
  const bottomPad = Math.max(insets.bottom, isTablet ? 40 : 24);
  const thumbW = row ? (isTablet ? 300 : 224) : Math.min(width - sidePad * 2, 320);
  const titleSize = isTablet ? 32 : 23;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.root, { opacity: fade }]} accessibilityViewIsModal>
      {/* Fond : bannière série en dézoom, repli dégradé sombre. */}
      <LinearGradient colors={[...FALLBACK_COLORS]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}>
        <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      </Animated.View>
      {/* Deux voiles, comme sur le bureau : latéral puis vertical. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.52)", "rgba(0,0,0,0.26)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.20)", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Absorbe les taps de fond — rien ne traverse vers le lecteur. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessibilityElementsHidden />

      {/* Croix = retour à la fiche (le refus de l'affiche sort du lecteur). */}
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("backToDetails")}
        hitSlop={10}
        style={({ pressed }) => [
          st.cross,
          { top: Math.max(insets.top, 16) + 4, right: Math.max(insets.right, 16) + 4 },
          pressed && { opacity: 0.75 },
        ]}
      >
        <X size={22} color={PLAYER.text} />
      </Pressable>

      {/* Panneau bas-gauche. */}
      <Animated.View
        style={[
          st.panel,
          {
            paddingLeft: sidePad,
            paddingRight: Math.max(insets.right, 24),
            paddingBottom: bottomPad,
            flexDirection: row ? "row" : "column",
            alignItems: row ? "flex-end" : "stretch",
            gap: row ? 24 : 14,
            opacity: panel,
            transform: [{ translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}
      >
        <View style={{ width: thumbW, aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", backgroundColor: "#16131c" }}>
          <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        </View>

        <View style={{ flex: row ? 1 : undefined, minWidth: 0 }}>
          <Text style={st.eyebrow}>{t("upNext")}</Text>
          {episodeLabel && <Text style={st.epLabel}>{episodeLabel}</Text>}
          <Text numberOfLines={2} style={[st.title, { fontSize: titleSize, lineHeight: titleSize + 5 }]}>
            {nextEpisode.Name}
          </Text>
          {!!nextEpisode.Overview && (
            <Text numberOfLines={3} style={[st.overview, isTablet && { fontSize: 15, lineHeight: 22 }]}>
              {nextEpisode.Overview}
            </Text>
          )}
          <View style={st.actions}>
            <OverlayPill
              key={armed?.key ?? "manual"}
              label={
                countdownSeconds !== null
                  ? t("playNowIn", { seconds: countdownSeconds })
                  : t("playNow")
              }
              onPress={onPlay}
              countdownMs={armed?.remainingMs ?? null}
              initialProgress={armed?.initialProgress ?? 0}
              icon={<Play size={15} color={PLAYER.textInverse} fill={PLAYER.textInverse} />}
            />
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              style={({ pressed }) => [st.ghost, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.ghostLabel}>{t("backToDetails")}</Text>
            </Pressable>
          </View>

          {/* Noter l'épisode FINI — geste secondaire, sous les actions ; poser
              une étoile tue le décompte, la surface reste une proposition. */}
          {rating && (
            <View style={st.ratingBlock}>
              <Text style={st.rateLabel}>
                {t("rateJustWatched")}
                {rating.episodeCode ? ` — ${rating.episodeCode}` : ""}
              </Text>
              <View style={st.ratingRow}>
                <StarRatingMobile
                  value={rating.value}
                  onRate={(score) => {
                    onRatingEngage?.();
                    rating.rate(score);
                  }}
                  onClear={() => {
                    onRatingEngage?.();
                    rating.clear();
                  }}
                />
                {rating.value != null && (
                  <Text style={st.rateValue}>{tReco("ratingValue", { score: rating.value })}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { zIndex: 60, overflow: "hidden", backgroundColor: PLAYER.bg },
  cross: {
    position: "absolute",
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1 },
  eyebrow: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 4,
  },
  epLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 6,
  },
  title: {
    color: PLAYER.text,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 14,
  },
  overview: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  ghost: {
    minHeight: 44,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostLabel: { color: "rgba(255, 255, 255, 0.85)", fontSize: 14, fontWeight: "600" },
  ratingBlock: { marginTop: 18 },
  rateLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 4,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  rateValue: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
