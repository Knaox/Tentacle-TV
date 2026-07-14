import { type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { typography, FONT_FAMILY, RADIUS, useResponsive, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

function formatRuntime(ticks: number): string {
  const mins = Math.round(ticks / 600_000_000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

interface HeroContentProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

/**
 * Contenu du HeroBanner (logo/titre + méta + overview + CTAs). Extrait du
 * HeroBanner (règle 300 lignes). Agrandit typo/CTA sur tablette (`isTablet`).
 */
export function HeroContent({ item, onPlay, onInfo }: HeroContentProps): ReactNode {
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
            <View style={[st.progFill, { width: `${progress}%` as unknown as number }]} />
          </View>
          <Text style={st.progLbl}>{Math.round(progress)}%</Text>
        </View>
      )}

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
          <Feather name="info" size={16} color={theme.colors.text.primary} />
          <Text style={st.infoTxt}>{t("moreInfo")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  tagRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12, flexWrap: "wrap" as const },
  // Pastille contrastée sur image (blanc/noir en sombre, inversion cohérente en clair).
  continueTag: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, backgroundColor: t.colors.cta.primaryBg, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 },
  continueTagTxt: { fontSize: 9.5, fontFamily: FONT_FAMILY.extrabold, color: t.colors.cta.primaryFg, letterSpacing: 1.6, textTransform: "uppercase" as const },
  epLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, letterSpacing: 0.2 },
  logo: { width: 280, maxWidth: "85%", height: 92, marginBottom: 14 },
  title: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, marginBottom: 14, letterSpacing: -0.6, lineHeight: 36, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  meta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 10, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  metaTxtMuted: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  rBadge: { borderWidth: 1, borderColor: withAlpha(t.colors.text.primary, 0.45, t.colors.border.strong), borderRadius: 3, paddingHorizontal: 5, paddingVertical: 0.5 },
  rBadgeTxt: { fontSize: 9, fontFamily: FONT_FAMILY.bold, color: t.colors.text.secondary, letterSpacing: 0.6 },
  ratingBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  rating: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.rating },
  overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary, lineHeight: 21, marginBottom: 18, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 18, maxWidth: 280 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: t.colors.fill.strong, overflow: "hidden" as const },
  progFill: { height: "100%" as const, borderRadius: 2, backgroundColor: t.colors.brand.violet },
  progLbl: { fontSize: 11, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
  btns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 9,
    backgroundColor: t.colors.cta.primaryBg, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 26,
    shadowColor: t.colors.brand.violet, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 22, elevation: 12,
  },
  playTxt: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg, letterSpacing: 0.1 },
  infoBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: t.colors.brand.ghost, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 18,
    borderWidth: 1, borderColor: withAlpha(t.colors.brand.violet, 0.4, t.colors.brand.glow),
  },
  infoTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
});
