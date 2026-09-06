import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { watchStateOf } from "@tentacle-tv/offline-core";
import { CascadeGroup } from "@/components/hero/CascadeGroup";
import { HeroEyebrow } from "@/components/hero/HeroEyebrow";
import { makeHeroCtaStyles } from "@/components/hero/heroCtaStyles";
import { makeHeroTextStyles } from "@/components/hero/heroTextStyles";
import { useLocalArtworkUri, useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";
import { variantLabel } from "@/offline/manage/OfflineEntryRow";
import { useResponsive, useTheme, useThemedStyles } from "@/theme";

interface Props {
  entry: OfflineEntry;
  /** La diapositive est celle affichée — sa cascade de texte se (re)joue. */
  active: boolean;
  onPlay: (entry: OfflineEntry) => void;
  onInfo: (entry: OfflineEntry) => void;
}

/**
 * Le contenu d'une diapositive du bandeau local — le jumeau de `HeroContent`
 * sans une URL serveur : sur-titre « Sur l'appareil · Qualité d'origine »,
 * étiquette Continuer / Vu / S01E03, LOGO du snapshot (enfin rendu) sinon le
 * titre, méta (année, classification, note, durée, genres), synopsis,
 * progression au halo rose, puis Reprendre / Lire et Plus d'infos.
 */
export function OfflineHeroContent({ entry, active, onPlay, onInfo }: Props) {
  const { t } = useTranslation(["common", "offline", "downloads"]);
  const theme = useTheme();
  const st = useThemedStyles(makeHeroTextStyles);
  const cta = useThemedStyles(makeHeroCtaStyles);
  const { isTablet } = useResponsive();
  const { data: item } = useLocalSnapshotJson<MediaItem>(entry.itemId, "item.json");
  const logoUri = useLocalArtworkUri(entry.itemId, "logo.png");

  const isEpisode = entry.kind === "episode";
  const displayName = isEpisode
    ? (entry.seriesName ?? item?.SeriesName ?? entry.title ?? entry.itemId)
    : (item?.Name ?? entry.title ?? entry.itemId);
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const episodeLabel = isEpisode ? [code, item?.Name ?? entry.title].filter(Boolean).join(" · ") : null;
  const { watched, percent } = watchStateOf(entry);
  const progress = percent ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const genres = item?.Genres?.slice(0, 2) ?? [];
  const runtime = formatDuration(item?.RunTimeTicks ?? entry.runtimeTicks ?? undefined);
  const overview = (item?.Overview ?? "").replace(/<[^>]+>/g, "").trim();
  const quality = variantLabel(entry, (key) => t(`downloads:${key}`), (key) => t(`offline:${key}`));

  return (
    <View>
      <CascadeGroup order={0} active={active}>
        <View style={{ marginBottom: 12 }}>
          <HeroEyebrow label={t("offline:stateOnDevice")} hint={quality} />
        </View>
        {(hasProgress || watched || episodeLabel) && (
          <View style={st.tagRow}>
            {hasProgress && (
              <View style={st.continueTag}>
                <Feather name="play" size={9} color={theme.colors.cta.primaryBg} fill={theme.colors.cta.primaryBg} />
                <Text style={st.continueTagTxt}>{t("common:continueLabel")}</Text>
              </View>
            )}
            {watched && !hasProgress && (
              <View style={st.continueTag}>
                <Feather name="check" size={10} color={theme.colors.cta.primaryFg} />
                <Text style={st.continueTagTxt}>{t("common:watched")}</Text>
              </View>
            )}
            {episodeLabel ? <Text style={st.epLabel} numberOfLines={1}>{episodeLabel}</Text> : null}
          </View>
        )}
        {logoUri ? (
          <Image
            source={{ uri: logoUri }}
            style={[st.logo, isTablet && { width: 380, height: 124, marginBottom: 18 }]}
            contentFit="contain"
            cachePolicy="none"
            accessibilityLabel={displayName}
          />
        ) : (
          <Text style={[st.title, isTablet && { fontSize: 46, lineHeight: 52, marginBottom: 18 }]} numberOfLines={3} maxFontSizeMultiplier={1.15}>
            {displayName}
          </Text>
        )}
      </CascadeGroup>

      <CascadeGroup order={1} active={active}>
        <View style={st.meta}>
          {item?.ProductionYear != null && <Text style={st.metaTxt}>{item.ProductionYear}</Text>}
          {item?.OfficialRating != null && (
            <View style={st.rBadge}><Text style={st.rBadgeTxt}>{item.OfficialRating}</Text></View>
          )}
          {item?.CommunityRating != null && (
            <View style={st.ratingBox}>
              <Feather name="star" size={11} color={theme.colors.status.rating} />
              <Text style={st.rating}>{item.CommunityRating.toFixed(1)}</Text>
            </View>
          )}
          {runtime ? <Text style={st.metaTxt}>{runtime}</Text> : null}
          {genres.map((genre) => <Text key={genre} style={st.metaTxtMuted}>· {genre}</Text>)}
        </View>

        {overview.length > 0 && (
          <Text style={[st.overview, isTablet && { fontSize: 17, lineHeight: 25 }]} numberOfLines={isTablet ? 3 : 2}>{overview}</Text>
        )}

        {hasProgress && (
          <View style={st.progRow}>
            <View style={st.progTrack}>
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
            onPress={() => onPlay(entry)}
            accessibilityRole="button"
            accessibilityLabel={`${hasProgress ? t("common:resume") : t("common:play")} ${displayName}`}
          >
            <Feather name="play" size={20} color={theme.colors.cta.primaryFg} fill={theme.colors.cta.primaryFg} />
            <Text style={cta.playTxt}>{hasProgress ? t("common:resume") : t("common:play")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [cta.infoBtn, isTablet && cta.infoBtnTablet, pressed && cta.pressed]}
            onPress={() => onInfo(entry)}
            accessibilityRole="button"
            accessibilityLabel={`${t("common:moreInfo")} ${displayName}`}
          >
            <Feather name="info" size={16} color={theme.colors.onMedia.primary} />
            <Text style={cta.infoTxt}>{t("common:moreInfo")}</Text>
          </Pressable>
        </View>
      </CascadeGroup>
    </View>
  );
}
