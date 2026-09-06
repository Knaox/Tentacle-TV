import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import { watchStateOf } from "@tentacle-tv/offline-core";
import { PressableCard, ProgressBar } from "@/components/ui";
import { useLocalTrickplay } from "@/hooks/offline/useLocalTrickplay";
import type { OfflineEntry } from "@/offline/engineApi";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { ResumeSpriteImage } from "./ResumeSpriteImage";

interface Props {
  entry: OfflineEntry;
  width: number;
  /** La carte ouvre la fiche… */
  onSelect: (entry: OfflineEntry) => void;
  /** …le bouton superposé lance la lecture. */
  onPlay: (entry: OfflineEntry) => void;
}

/** La vignette d'un épisode, puis la bannière de la série comme repli. */
const EPISODE_ART = ["primary.jpg", "backdrop.jpg"] as const;

/**
 * Carte HORIZONTALE (16:9) d'un épisode gardé sur l'appareil. Le titre est
 * posé sur la vignette (blanc constant, règle « posé sur média »), la reprise
 * remplace la vignette par la case trickplay exacte, et coche OU barre, jamais
 * les deux — la règle des cartes en ligne.
 */
export const OfflineEpisodeCard = memo(function OfflineEpisodeCard({ entry, width, onSelect, onPlay }: Props) {
  const { t } = useTranslation(["downloads", "common"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { watched, percent } = watchStateOf(entry);
  // Le manifeste local n'est lu que pour un épisode entamé : les autres cartes
  // gardent leur vignette sans ouvrir de fichier.
  const local = useLocalTrickplay(entry.positionTicks > 0 && !watched ? entry.itemId : undefined);

  const title = entry.title ?? entry.itemId;
  // Numéros absents (rattrapage en attente) : pas de « S00E00 » inventé.
  const code = entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const runtime = formatDuration(entry.runtimeTicks ?? undefined);
  const caption = [code, runtime].filter(Boolean).join(" · ");

  return (
    <PressableCard
      onPress={() => onSelect(entry)}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${caption ? `${caption}, ` : ""}${title}${percent !== null ? `, ${Math.round(percent)} %` : ""}`}
    >
      <View style={st.thumb}>
        <View style={st.clip} pointerEvents="none">
          <View style={st.fallback}>
            <Text style={st.fallbackText}>{entry.indexNumber != null ? `E${entry.indexNumber}` : title.charAt(0).toUpperCase()}</Text>
          </View>
          <OfflineLocalImage itemId={entry.itemId} candidates={EPISODE_ART} style={StyleSheet.absoluteFill} />
          {local && <ResumeSpriteImage local={local} positionTicks={entry.positionTicks} />}
          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.78)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
          <Text numberOfLines={2} style={st.onMediaTitle}>{title}</Text>
        </View>

        <Pressable
          onPress={() => onPlay(entry)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("downloads:episodePlay")}
          style={({ pressed }) => [st.play, pressed && { opacity: 0.8 }]}
        >
          <Feather name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
        </Pressable>

        {watched ? (
          <View style={st.watchedBadge}>
            <Feather name="check" size={12} color={theme.colors.cta.primaryFg} />
          </View>
        ) : percent !== null && percent > 0 ? (
          <View style={st.progWrap}>
            <ProgressBar progress={percent / 100} height={3} />
          </View>
        ) : null}
      </View>
      {caption ? <Text numberOfLines={1} style={st.caption}>{caption}</Text> : null}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    thumb: { aspectRatio: 16 / 9, borderRadius: RADIUS.lg, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2 },
    clip: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
    fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    fallbackText: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    onMediaTitle: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 10,
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: "#fff",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 4,
    },
    play: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 44,
      height: 44,
      marginTop: -22,
      marginLeft: -22,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    progWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
    watchedBadge: {
      position: "absolute",
      top: 7,
      right: 7,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.cta.primaryBg,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 4,
    },
    caption: { ...typography.badge, color: t.colors.text.tertiary, marginTop: 6 },
  });
