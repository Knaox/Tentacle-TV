import { useEffect, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from "react-native-reanimated";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { typography, FONT_FAMILY, RADIUS, motion, useResponsive, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/**
 * La cascade de texte du hero desktop (fadeUp + stagger) : chaque groupe
 * monte de huit points en fondu, décalé de 40 ms par rang. Rejouée à chaque
 * slide qui devient actif ; inerte (opacité pleine) en mouvement réduit.
 * Transform/opacity uniquement — jamais de layout.
 */
function CascadeGroup({ order, active, children }: { order: number; active: boolean; children: ReactNode }) {
  const reduced = motion.isReducedMotion();
  const progress = useSharedValue(reduced || active ? 1 : 0);
  useEffect(() => {
    if (reduced) { progress.value = 1; return; }
    if (active) {
      progress.value = 0;
      progress.value = withDelay(order * 40, withTiming(1, { duration: 220 }));
    }
  }, [active, order, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function formatRuntime(ticks: number): string {
  const mins = Math.round(ticks / 600_000_000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

interface HeroContentProps {
  item: MediaItem;
  /** Le slide est celui affiché — sa cascade de texte se (re)joue. */
  active?: boolean;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

/**
 * Contenu du HeroBanner (logo/titre + méta + overview + CTAs). Extrait du
 * HeroBanner (règle 300 lignes). Agrandit typo/CTA sur tablette (`isTablet`).
 */
export function HeroContent({ item, active = true, onPlay, onInfo }: HeroContentProps): ReactNode {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const { isTablet } = useResponsive();
  const isEpisode = item.Type === "Episode";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const hasLogo = item.ImageTags?.Logo != null;
  const logoUrl = hasLogo ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 }) : null;
  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const episodeLabel = isEpisode
    ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber ?? 1).padStart(2, "0")} · ${item.Name}`
    : null;
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const isWatched = item.UserData?.Played === true;
  const genres = item.Genres?.slice(0, 2) ?? [];
  const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;

  return (
    <View>
      <CascadeGroup order={0} active={active}>
      {(hasProgress || isWatched || episodeLabel) && (
        <View style={st.tagRow}>
          {hasProgress && (
            <View style={st.continueTag}>
              <Feather name="play" size={9} color={theme.colors.cta.primaryBg} fill={theme.colors.cta.primaryBg} />
              <Text style={st.continueTagTxt}>{t("continueLabel")}</Text>
            </View>
          )}
          {isWatched && !hasProgress && (
            <View style={st.continueTag}>
              <Feather name="check" size={10} color={theme.colors.cta.primaryFg} />
              <Text style={st.continueTagTxt}>{t("watched")}</Text>
            </View>
          )}
          {episodeLabel && <Text style={st.epLabel} numberOfLines={1}>{episodeLabel}</Text>}
        </View>
      )}

      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={[st.logo, isTablet && { width: 380, height: 124, marginBottom: 18 }]} contentFit="contain" />
      ) : (
        <Text style={[st.title, isTablet && { fontSize: 46, lineHeight: 52, marginBottom: 18 }]} numberOfLines={3} maxFontSizeMultiplier={1.15}>{displayName}</Text>
      )}
      </CascadeGroup>

      <CascadeGroup order={1} active={active}>
      <View style={st.meta}>
        {item.ProductionYear != null && <Text style={st.metaTxt}>{item.ProductionYear}</Text>}
        {item.OfficialRating != null && (
          <View style={st.rBadge}><Text style={st.rBadgeTxt}>{item.OfficialRating}</Text></View>
        )}
        {item.CommunityRating != null && (
          <View style={st.ratingBox}>
            <Feather name="star" size={11} color={theme.colors.status.rating} />
            <Text style={st.rating}>{item.CommunityRating.toFixed(1)}</Text>
          </View>
        )}
        {runtime && <Text style={st.metaTxt}>{runtime}</Text>}
        {genres.map((g) => <Text key={g} style={st.metaTxtMuted}>· {g}</Text>)}
      </View>

      {item.Overview != null && <Text style={[st.overview, isTablet && { fontSize: 17, lineHeight: 25 }]} numberOfLines={isTablet ? 3 : 2}>{item.Overview}</Text>}

      {hasProgress && (
        <View style={st.progRow}>
          <View style={st.progTrack}>
            {/* Le dégradé de marque du bureau (--progress-fill) + halo rose. */}
            <LinearGradient
              colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[st.progFill, { width: `${progress}%` as unknown as number }]}
            />
          </View>
          <Text style={st.progLbl}>{Math.round(progress)}%</Text>
        </View>
      )}
      </CascadeGroup>

      <CascadeGroup order={2} active={active}>
      <View style={st.btns}>
        <Pressable
          style={({ pressed }) => [st.playBtn, isTablet && { paddingVertical: 16, paddingHorizontal: 34 }, pressed && { opacity: 0.88 }]}
          onPress={() => onPlay(item)}
          accessibilityRole="button"
          accessibilityLabel={`${hasProgress ? t("resume") : t("play")} ${item.Name}`}
        >
          <Feather name="play" size={20} color={theme.colors.cta.primaryFg} fill={theme.colors.cta.primaryFg} />
          <Text style={st.playTxt}>{hasProgress ? t("resume") : t("play")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [st.infoBtn, isTablet && { paddingVertical: 16, paddingHorizontal: 24 }, pressed && { opacity: 0.88 }]}
          onPress={() => onInfo(item)}
          accessibilityRole="button"
          accessibilityLabel={`${t("moreInfo")} ${item.Name}`}
        >
          <Feather name="info" size={16} color={theme.colors.onMedia.primary} />
          <Text style={st.infoTxt}>{t("moreInfo")}</Text>
        </Pressable>
      </View>
      </CascadeGroup>
    </View>
  );
}

// Tout le contenu du Hero est posé DIRECTEMENT sur l'affiche → texte via
// onMedia.* (blanc + voile sombre, constant dans les deux thèmes) pour rester
// lisible sur n'importe quelle image, thème clair inclus. `overview` garde son
// halo via onMedia.shadow. Rendu sombre inchangé (mêmes valeurs blanches).
const makeStyles = (t: AppTheme) => StyleSheet.create({
  tagRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12, flexWrap: "wrap" as const },
  // Pastille contrastée sur image : violette en clair, blanche en sombre (cta.primaryBg).
  continueTag: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, backgroundColor: t.colors.cta.primaryBg, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 },
  continueTagTxt: { fontSize: 9.5, fontFamily: FONT_FAMILY.extrabold, color: t.colors.cta.primaryFg, letterSpacing: 1.6, textTransform: "uppercase" as const },
  epLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.onMedia.secondary, letterSpacing: 0.2 },
  logo: { width: 280, maxWidth: "85%", height: 92, marginBottom: 14 },
  title: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: t.colors.onMedia.primary, marginBottom: 14, letterSpacing: -0.6, lineHeight: 36, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  meta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 10, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.secondary },
  metaTxtMuted: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.onMedia.secondary },
  rBadge: { borderWidth: 1, borderColor: withAlpha(t.colors.onMedia.primary, 0.45, t.colors.border.strong), borderRadius: 3, paddingHorizontal: 5, paddingVertical: 0.5 },
  rBadgeTxt: { fontSize: 9, fontFamily: FONT_FAMILY.bold, color: t.colors.onMedia.secondary, letterSpacing: 0.6 },
  ratingBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  rating: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.rating },
  overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: t.colors.onMedia.secondary, lineHeight: 21, marginBottom: 18, textShadowColor: t.colors.onMedia.shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 18, maxWidth: 280 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: t.colors.fill.strong, overflow: "hidden" as const },
  progFill: {
    height: "100%" as const, borderRadius: 2,
    // Halo rose du bureau (--progress-glow) — iOS ; Android reste net.
    shadowColor: t.colors.brand.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 5,
  },
  progLbl: { fontSize: 11, fontFamily: FONT_FAMILY.bold, color: t.colors.onMedia.secondary },
  btns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  // Les deux CTA sont les pilules du bureau (HeroActions) : « Lire » en blanc
  // à l'ombre NEUTRE — le halo violet a vécu —, « Plus d'infos » en verre
  // sombre constant posé sur l'affiche (jamais les tokens ghost de page).
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 9,
    backgroundColor: t.colors.cta.primaryBg, borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 26,
    borderWidth: t.colors.cta.primaryBorder ? 1 : 0, borderColor: t.colors.cta.primaryBorder,
    ...(t.isDark
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }
      : t.colors.shadow.card),
  },
  playTxt: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg, letterSpacing: 0.1 },
  infoBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: "rgba(10, 10, 16, 0.45)", borderRadius: RADIUS.pill, minHeight: 44, paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 1, borderColor: withAlpha(t.colors.onMedia.primary, 0.28, t.colors.border.strong),
  },
  infoTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.onMedia.primary },
});
