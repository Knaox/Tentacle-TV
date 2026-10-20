import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react-native";
import { BRAND } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";
import type { EpisodeEntry } from "../../../player/episodes/episodeBrowserModel";
import { EB, brandGauge } from "./browserTokens";

const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];

interface Props {
  entry: EpisodeEntry;
  width: number;
  radius: number;
  /** L'image de l'épisode ; `null` : son numéro sur un fond sombre. */
  artwork: ReactNode;
  /** « En cours » posé dans l'image (étagère) plutôt que dans le texte. */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * La vignette 16:9 d'un épisode et ses marqueurs — ceux de toutes les cartes :
 * la pastille « vu » en haut à droite, la jauge de la marque au pied d'un
 * épisode entamé. Sans image, son numéro, en grand, comme la TV.
 */
export const EpisodeArtwork = memo(function EpisodeArtwork({ entry, width, radius, artwork, badge = false, style }: Props) {
  const height = Math.round((width * 9) / 16);
  const large = width >= 200;
  return (
    <View style={[{ width, height, borderRadius: radius }, st.frame, style]}>
      {artwork ?? <MissingArtwork number={entry.number} large={large} />}
      {entry.progress !== null && (
        <BrandGauge progress={entry.progress} style={[st.gauge, large && st.gaugeLarge]} height={large ? 4 : 3} />
      )}
      <CardStatusMarkers statuses={entry.watched ? WATCHED : NONE} style={st.status} />
      {badge && entry.current && <NowPlayingBadge />}
    </View>
  );
});

function MissingArtwork({ number, large }: { number?: number; large: boolean }) {
  return (
    <LinearGradient colors={[EB.thumbFallbackEdge, EB.thumbFallback]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.missing}>
      {number !== undefined ? <Text style={[st.missingNumber, large && st.missingNumberLarge]}>{number}</Text> : null}
    </LinearGradient>
  );
}

/** La jauge d'un épisode entamé : la piste claire, le remplissage violet → rose. */
export function BrandGauge({ progress, height = 3, style }: { progress: number; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: EB.gaugeTrack, overflow: "hidden" }, style]}>
      <LinearGradient
        colors={brandGauge()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${Math.max(4, Math.min(100, progress))}%`, height: "100%", borderRadius: height / 2 }}
      />
    </View>
  );
}

/** « En cours » : la seule pièce pleine de la marque, en version profonde (le blanc y tient 4,6:1). */
export function NowPlayingBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation("player");
  return (
    <LinearGradient colors={[BRAND.dark, BRAND.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.badge, style]}>
      <Play size={9} color={EB.label} fill={EB.label} strokeWidth={0} />
      <Text style={st.badgeText} numberOfLines={1}>{t("panels.nowPlaying")}</Text>
    </LinearGradient>
  );
}

const st = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: EB.thumbFallback },
  missing: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 10 },
  missingNumber: { color: "rgba(255, 255, 255, 0.5)", fontSize: 24, fontWeight: "300", fontVariant: ["tabular-nums"] },
  missingNumberLarge: { fontSize: 34, letterSpacing: -0.5 },
  gauge: { position: "absolute", left: 7, right: 7, bottom: 7 },
  gaugeLarge: { left: 10, right: 10, bottom: 9 },
  status: { top: 6, right: 6 },
  badge: { position: "absolute", top: 8, left: 8, height: 22, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, borderRadius: 11 },
  badgeText: { color: EB.label, fontSize: 12, fontWeight: "700", letterSpacing: 0.1 },
});
