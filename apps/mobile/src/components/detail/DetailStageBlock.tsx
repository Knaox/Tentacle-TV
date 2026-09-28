import { memo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCardMarkers, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatCommunityRating, ticksToSeconds, type CardStatusKind, type MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme } from "@/theme";
import { BookmarkGlyph, HeartGlyph, StarGlyph, WatchedGlyph } from "../cards/cardGlyphs";
import { MetaTokens } from "./MetaTokens";

const KIND_KEYS: Partial<Record<MediaItem["Type"], string>> = {
  Movie: "kindMovie", Series: "kindSeries", Season: "kindSeason", BoxSet: "kindCollection",
};
const STATUS_GLYPH: Record<CardStatusKind, typeof BookmarkGlyph> = {
  watchlist: BookmarkGlyph, favorite: HeartGlyph, watched: WatchedGlyph,
};

interface Props {
  item: MediaItem;
  /** `center` : dans la scène (portrait) ; `start` : colonne gauche de l'iPad paysage. */
  align: "center" | "start";
  /**
   * `media` : posé sur le décor (blanc + ombre, dans les deux thèmes).
   * `themed` : posé sur la page voilée (colonne de l'iPad paysage).
   */
  tone: "media" | "themed";
  logoMaxW: number;
  logoMaxH: number;
  titleStyle?: StyleProp<ViewStyle>;
  metaStyle?: StyleProp<ViewStyle>;
}

/**
 * Le bloc titre de la scène : surtitre, LOGO du titre (le nom en texte à
 * défaut, et toujours pour un épisode), la note du public en grand avec les
 * marqueurs des cartes (mêmes tracés), la ligne de faits et les jetons.
 * Jumeau de `StageBlock` du miroir web.
 */
export const DetailStageBlock = memo(function DetailStageBlock({ item, align, tone, logoMaxW, logoMaxH, titleStyle, metaStyle }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { t: tm } = useTranslation("media");
  const { t: tc } = useTranslation("cards");
  const client = useJellyfinClient();
  const theme = useTheme();
  const [logoBroken, setLogoBroken] = useState(false);
  const [logoRatio, setLogoRatio] = useState(3);
  const markers = useCardMarkers(item, { communityRating: item.CommunityRating ?? null, scope: "item" });

  const onMedia = tone === "media";
  const c = onMedia
    ? { primary: theme.colors.onMedia.primary, secondary: theme.colors.onMedia.secondary, muted: theme.colors.onMedia.muted, shadow: theme.colors.onMedia.shadow }
    : { primary: theme.colors.text.primary, secondary: theme.colors.text.secondary, muted: theme.colors.border.strong, shadow: "transparent" };
  const shadow = { textShadowColor: c.shadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };
  const centered = align === "center";
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const logoTag = !isEpisode ? item.ImageTags?.Logo : undefined;
  const logo = logoTag && !logoBroken
    ? client.getImageUrl(item.Id, "Logo", { height: logoMaxH * 2, quality: 90, tag: logoTag })
    : null;
  // La boîte du logo suit son format réel (mesuré au chargement) : ni bande
  // vide autour d'un logo étroit, ni logo large écrasé.
  const logoW = Math.min(logoMaxW, logoMaxH * logoRatio);
  const logoH = logoW / logoRatio;

  const runtimeMin = item.RunTimeTicks && item.Type !== "BoxSet" ? Math.round(ticksToSeconds(item.RunTimeTicks) / 60) : null;
  const kicker = isEpisode ? "" : [
    KIND_KEYS[item.Type] ? tm(KIND_KEYS[item.Type] as string) : null,
    isSeries && item.Status ? (item.Status === "Continuing" ? t("ongoing") : t("ended")) : null,
  ].filter(Boolean).join(" · ");
  const facts = [
    item.ProductionYear ? String(item.ProductionYear) : null,
    runtimeMin ? t("minutesShort", { count: runtimeMin }) : null,
    isSeries && item.ChildCount ? t("seasonsCount", { count: item.ChildCount }) : null,
  ].filter(Boolean).join("  ·  ");
  const code = isEpisode && item.IndexNumber != null
    ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
    : "";
  const alignItems = centered ? "center" as const : "flex-start" as const;

  return (
    <View style={{ alignItems }}>
      <Animated.View style={[{ alignItems }, titleStyle]}>
        {isEpisode && item.SeriesName && (
          <Pressable
            onPress={() => item.SeriesId && router.push(`/media/${item.SeriesId}`)}
            disabled={!item.SeriesId}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={item.SeriesName}
            style={st.seriesLink}
          >
            <Text numberOfLines={1} style={[st.series, { color: c.secondary }, shadow]}>{item.SeriesName}</Text>
            {item.SeriesId && <Feather name="chevron-right" size={14} color={c.secondary} />}
          </Pressable>
        )}
        {kicker !== "" && (
          <View style={st.kickerRow}>
            <View style={[st.dot, { backgroundColor: theme.colors.brand.accent }]} />
            <Text style={[st.kicker, { color: c.secondary }, shadow]} numberOfLines={1}>{kicker}</Text>
          </View>
        )}
        {logo ? (
          <Image
            source={{ uri: logo }}
            accessibilityRole="header"
            accessibilityLabel={item.Name}
            resizeMode="contain"
            onError={() => setLogoBroken(true)}
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width > 0 && height > 0) setLogoRatio(width / height);
            }}
            style={{ width: logoW, height: logoH }}
          />
        ) : (
          <Text style={[st.title, { color: c.primary, textAlign: centered ? "center" : "left" }, shadow]} numberOfLines={3} accessibilityRole="header">
            {code}{item.Name}
          </Text>
        )}
      </Animated.View>

      <Animated.View style={[{ alignItems }, metaStyle]}>
        {(markers.communityRating !== null || markers.statuses.length > 0) && (
          <View style={st.scoreRow}>
            {markers.communityRating !== null && (
              <View style={st.score} accessible accessibilityLabel={tc("communityRating", { score: formatCommunityRating(markers.communityRating) })}>
                <StarGlyph size={17} color={theme.colors.brand.accentLight} />
                <Text style={[st.scoreValue, { color: c.primary }, shadow]}>{formatCommunityRating(markers.communityRating)}</Text>
                <Text style={[st.scoreMax, { color: c.muted }]}>/10</Text>
              </View>
            )}
            {markers.statuses.map((kind) => {
              const Glyph = STATUS_GLYPH[kind];
              return (
                <View key={kind} accessible accessibilityLabel={tc(`status.${kind}`)} style={[st.marker, { borderColor: c.muted, backgroundColor: onMedia ? "rgba(0,0,0,0.4)" : theme.colors.fill.subtle }]}>
                  <Glyph size={14} filled color={kind === "favorite" ? theme.colors.brand.accentLight : theme.colors.brand.light} />
                </View>
              );
            })}
          </View>
        )}
        {(facts !== "" || !!item.OfficialRating) && (
          <View style={st.factsRow}>
            {item.OfficialRating ? (
              <View style={[st.rated, { borderColor: c.muted }]}><Text style={[st.ratedTxt, { color: c.secondary }]}>{item.OfficialRating}</Text></View>
            ) : null}
            {facts !== "" && <Text style={[st.facts, { color: c.secondary }, shadow]}>{facts}</Text>}
          </View>
        )}
        <MetaTokens item={item} onMedia={onMedia} />
      </Animated.View>
    </View>
  );
});

const st = StyleSheet.create({
  seriesLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  series: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, letterSpacing: 1, textTransform: "uppercase" },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  kicker: { fontSize: 11, fontFamily: FONT_FAMILY.semibold, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontSize: 30, lineHeight: 33, fontFamily: FONT_FAMILY.extrabold, letterSpacing: -0.8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  score: { flexDirection: "row", alignItems: "center", gap: 5 },
  scoreValue: { fontSize: 20, fontFamily: FONT_FAMILY.bold, fontVariant: ["tabular-nums"] },
  scoreMax: { fontSize: 11, fontFamily: FONT_FAMILY.medium, alignSelf: "flex-end", marginBottom: 2 },
  marker: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  factsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  rated: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  ratedTxt: { fontSize: 10, fontFamily: FONT_FAMILY.bold },
  facts: { fontSize: 13, fontFamily: FONT_FAMILY.medium },
});
