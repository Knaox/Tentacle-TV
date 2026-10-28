/**
 * Octave (mobile) — une rangée de la FILE des transferts : la pochette (locale
 * quand elle est déjà là), le titre, l'étape en mots (« Transfert — 42 % »,
 * « Préparation par le serveur », « En attente », « En pause »), l'anneau qui se
 * remplit sur la pochette, et à droite le geste de la rangée (pause, reprise,
 * réessai, 44 pt). Toucher la rangée ouvre ses actions (retirer compris).
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { keptToTrack, trackFraction, trackStage } from "@tentacle-tv/offline-core/music";
import { keptMusicResourceUri } from "@/offline/engineMusicApi";
import { useTheme, withAlpha } from "@/theme";
import { useOctaveColors } from "../theme/octaveColors";
import { ProgressRing } from "./ProgressRing";
import { applyRowGesture, rowGesture } from "./transferGestures";

export const QUEUE_ROW_HEIGHT = 60;
const ART = 44;

const GESTURE_ICON = { pause: "pause", resume: "play", retry: "rotate-cw" } as const;

/** L'étape en mots ; une pause voulue se dit « En pause » (la règle partagée la range parmi l'attente). */
export function useStageText(k: KeptMusicTrack): string {
  const { t } = useTranslation("musicOffline");
  if (k.status === "paused" && k.pausedByUser) return t("transfers.stage.paused");
  const stage = trackStage(k);
  if (stage === "transferring") return t("transfers.stage.transferring", { percent: Math.floor(trackFraction(k) * 100) });
  if (stage === "preparing") return t("transfers.stage.preparing");
  if (stage === "failed") return t("transfers.stage.failed");
  return t("transfers.stage.waiting");
}

interface Props {
  kept: KeptMusicTrack;
  onOpen: (kept: KeptMusicTrack) => void;
}

export const TransferQueueRow = memo(function TransferQueueRow({ kept, onOpen }: Props) {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const { colors: theme } = useTheme();
  const stageText = useStageText(kept);
  const artwork = keptToTrack(kept, keptMusicResourceUri).artworkUrl;
  const gesture = rowGesture(kept);
  const gestureLabel = gesture === "pause" ? t("transfers.pause") : gesture === "resume" ? t("transfers.resume") : t("retry");
  const failed = kept.status === "error";
  const fraction = trackFraction(kept);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${kept.title}, ${stageText}`}
        onPress={() => onOpen(kept)}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.art, { backgroundColor: colors.pressed }]}>
          {artwork ? <Image source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={kept.trackKey} /> : <Feather name="music" size={18} color={colors.textTertiary} />}
          {!failed && (
            <View style={[styles.ring, { backgroundColor: withAlpha(colors.ink, 0.5, colors.ink) }]}>
              <ProgressRing fraction={fraction} size={32} stroke={3} color={colors.accent} track={colors.line} />
            </View>
          )}
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{kept.title}</Text>
          <Text style={[styles.stage, { color: failed ? theme.statusPairs.error.fg : colors.textSecondary }]} numberOfLines={1}>
            {kept.artist ? `${stageText} · ${kept.artist}` : stageText}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${gestureLabel}, ${kept.title}`}
        hitSlop={4}
        onPress={() => applyRowGesture(kept, gesture)}
        style={({ pressed }) => [styles.gesture, { backgroundColor: pressed ? colors.line : colors.pressed }]}
      >
        <Feather name={GESTURE_ICON[gesture]} size={18} color={colors.text} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: QUEUE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 8 },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  art: { width: ART, height: ART, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  // Le voile d'encre sous l'anneau : il se lit sur n'importe quelle pochette.
  ring: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: "600" },
  stage: { fontSize: 13, fontVariant: ["tabular-nums"] },
  gesture: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
