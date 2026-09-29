import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { isInProgress, watchStateOf } from "@tentacle-tv/offline-core";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";
import { MetaTokens } from "@/components/detail/MetaTokens";
import { makeEpisodeRowStyles } from "@/components/episodes/episodeRowStyles";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import { useLocalTrickplay } from "@/hooks/offline/useLocalTrickplay";
import type { OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { variantLabel } from "@/offline/manage/OfflineEntryRow";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { EPISODE_ART } from "./offlineArt";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { ResumeSpriteImage } from "./ResumeSpriteImage";
import { useOpenLocalSheet } from "./useOpenLocalSheet";

interface Props {
  entry: OfflineEntry;
  isCurrent?: boolean;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
}

const TICKS_PER_MINUTE = 600_000_000;
const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];

/**
 * Une ligne d'épisode gardé sur l'appareil — le dessin d'`EpisodeItemRow` :
 * vignette (l'image EXACTE de la reprise quand l'épisode est entamé), piste
 * de progression dégradée, « S01E03 · Titre », durée et version, jetons de
 * qualité, synopsis, et « ⋯ » vers la feuille de gestion. L'appui long ouvre
 * la feuille unique des cartes (vignette 16:9, mode local) : Lire, « vu »,
 * Plus d'infos, et « Gérer » vers la même gestion.
 *
 * « Vu » se lit sur la vignette, dans la pastille des cartes — pas « sur cet
 * appareil » : tout ce qui est ici l'est. Un anneau coché en bout de ligne,
 * l'ancien dessin, en tenait lieu ; la bascule est dans les deux feuilles.
 */
export const OfflineEpisodeRow = memo(function OfflineEpisodeRow({ entry, isCurrent, onPlay, onMore }: Props) {
  const { t } = useTranslation(["common", "offline", "downloads"]);
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeEpisodeRowStyles);
  const ex = useThemedStyles(makeExtraStyles);
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  const { data: item } = useLocalSnapshotJson<MediaItem>(entry.itemId, "item.json");
  const local = useLocalTrickplay(isInProgress(entry) ? entry.itemId : undefined);
  const { watched, percent } = watchStateOf(entry);
  const title = item?.Name ?? entry.title ?? entry.itemId;
  const code = entry.parentIndexNumber != null && entry.indexNumber != null
    ? `${formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })} · `
    : "";
  const runtime = entry.runtimeTicks ? Math.round(entry.runtimeTicks / TICKS_PER_MINUTE) : null;
  const version = [variantLabel(entry, (key) => t(`downloads:${key}`), (key) => t(`offline:${key}`)), formatBytes(entry.bytesDone)].join(" · ");
  const overview = (item?.Overview ?? "").replace(/<[^>]+>/g, "").trim();
  const openLocal = useOpenLocalSheet();

  return (
    <View style={st.row} collapsable={false}>
      <Pressable
        onPress={() => onPlay(entry)}
        onLongPress={openLocal ? () => openLocal(entry, "landscape", () => onMore(entry)) : undefined}
        style={st.main}
        accessibilityRole="button"
        accessibilityLabel={`${code}${title}`}
      >
        <View style={st.thumb}>
          <View style={ex.fallback}>
            <Text style={ex.fallbackText}>{entry.indexNumber != null ? `E${entry.indexNumber}` : title.charAt(0).toUpperCase()}</Text>
          </View>
          <OfflineLocalImage itemId={entry.itemId} candidates={EPISODE_ART} style={StyleSheet.absoluteFill} />
          {local && <ResumeSpriteImage local={local} positionTicks={entry.positionTicks} />}
          {percent !== null && percent > 0 && (
            <View style={st.progressTrack}>
              <LinearGradient colors={[colors.brand.violet, colors.brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: "100%", width: `${percent}%` }} />
            </View>
          )}
          <CardStatusMarkers statuses={watched ? WATCHED : NONE} style={ex.status} />
        </View>
        <View style={[st.body, ex.body]}>
          <View style={st.titleRow}>
            {isCurrent && <View style={st.currentDot} />}
            <Text numberOfLines={1} style={[st.title, isCurrent && { fontWeight: "800" }]}>{code}{title}</Text>
          </View>
          <View style={st.metaRow}>
            {isCurrent && <Text style={[st.current, { color: accentText }]}>{t("common:currentEpisode")}</Text>}
            {runtime ? <Text style={st.runtime}>{t("common:minutesShort", { count: runtime })}</Text> : null}
            <Text style={[st.runtime, ex.version]} numberOfLines={1}>{version}</Text>
          </View>
          <MetaTokens item={item ?? undefined} compact />
          {overview.length > 0 && <Text numberOfLines={2} style={st.overview}>{overview}</Text>}
        </View>
      </Pressable>

      <Pressable onPress={() => onMore(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("offline:manage")} style={[ex.more, ex.moreEnd]}>
        <Feather name="more-horizontal" size={18} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
});

const makeExtraStyles = (t: AppTheme) =>
  StyleSheet.create({
    fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    fallbackText: { fontSize: 14, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    more: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
    moreEnd: { marginRight: 6 },
    status: { top: 4, right: 4 },
    // Sans `minWidth: 0`, un texte long élargit le corps sous les boutons de droite.
    body: { minWidth: 0 },
    version: { flexShrink: 1 },
  });
