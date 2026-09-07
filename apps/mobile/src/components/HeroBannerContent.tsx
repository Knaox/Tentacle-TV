import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useResponsive, useTheme, useThemedStyles } from "@/theme";
import { CascadeGroup } from "./hero/CascadeGroup";
import { makeHeroCtaStyles } from "./hero/heroCtaStyles";
import { makeHeroTextStyles } from "./hero/heroTextStyles";

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
  const st = useThemedStyles(makeHeroTextStyles);
  const cta = useThemedStyles(makeHeroCtaStyles);
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
      <View style={cta.btns}>
        <Pressable
          style={({ pressed }) => [cta.playBtn, isTablet && cta.playBtnTablet, pressed && cta.pressed]}
          onPress={() => onPlay(item)}
          accessibilityRole="button"
          accessibilityLabel={`${hasProgress ? t("resume") : t("play")} ${item.Name}`}
        >
          <Feather name="play" size={20} color={theme.colors.cta.primaryFg} fill={theme.colors.cta.primaryFg} />
          <Text style={cta.playTxt}>{hasProgress ? t("resume") : t("play")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [cta.infoBtn, isTablet && cta.infoBtnTablet, pressed && cta.pressed]}
          onPress={() => onInfo(item)}
          accessibilityRole="button"
          accessibilityLabel={`${t("moreInfo")} ${item.Name}`}
        >
          <Feather name="info" size={16} color={theme.colors.onMedia.primary} />
          <Text style={cta.infoTxt}>{t("moreInfo")}</Text>
        </Pressable>
      </View>
      </CascadeGroup>
    </View>
  );
}
