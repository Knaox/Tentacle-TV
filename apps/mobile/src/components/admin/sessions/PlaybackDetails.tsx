import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  acceleratorLabel, channelsLabel, codecLabel, deliveryOf, formatBitrate, humanizeReason,
  joinParts, rangeLabel, resolutionLabel,
  type AdminSessionDto, type DeliveryKind,
} from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { DeliveryChip } from "./DeliveryChip";

const REASONS_KEY: Record<Exclude<DeliveryKind, "direct">, string> = {
  remux: "reasonsRemux",
  audio: "reasonsAudio",
  video: "reasons",
};

/**
 * Comment le média arrive à l'appareil : la sorte (pastille), la source, ce
 * qui est envoyé, et pourquoi le serveur travaille — les raisons se déplient
 * d'un geste. Les mêmes lignes que le bureau, calculées par les mêmes
 * fonctions partagées.
 */
export const PlaybackDetails = memo(function PlaybackDetails({ session }: { session: AdminSessionDto }) {
  const { t, i18n } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const [showReasons, setShowReasons] = useState(false);
  const { source, transcoding } = session;
  const kind = deliveryOf(session);

  const sourceLine = source
    ? joinParts([
        joinParts([codecLabel(source.videoCodec), resolutionLabel(source.width, source.height), rangeLabel(source.videoRange)]),
        joinParts([codecLabel(source.audioCodec), channelsLabel(source.audioChannels), source.audioLanguage?.toUpperCase()]),
        source.subtitle,
      ])
    : "";

  // Un remux ne change QUE le conteneur : c'est lui qu'on nomme.
  const outputLine = transcoding
    ? kind === "remux"
      ? joinParts([t("streamsCopied"), transcoding.container ? t("container", { name: transcoding.container.toUpperCase() }) : null])
      : joinParts([
          transcoding.isVideoDirect
            ? kind === "audio" ? t("videoDirect") : null
            : joinParts([codecLabel(transcoding.videoCodec), resolutionLabel(transcoding.width, transcoding.height)]),
          transcoding.isAudioDirect
            ? t("audioDirect")
            : joinParts([codecLabel(transcoding.audioCodec), channelsLabel(transcoding.audioChannels)]),
          formatBitrate(transcoding.bitrate, i18n.language),
          kind === "video" ? acceleratorLabel(transcoding.hardwareAccelerationType) ?? t("software") : null,
        ])
    : "";

  const reasons = transcoding?.reasons ?? [];
  const completion = transcoding?.completionPercentage;

  return (
    <View style={st.root}>
      <View style={st.chipRow}>
        <DeliveryChip kind={kind} />
        {completion !== undefined && kind !== "direct" && (
          <Text style={st.completion}>{t("completion", { percent: Math.round(completion) })}</Text>
        )}
      </View>
      {sourceLine !== "" && (
        <Text style={st.line}>
          <Text style={st.lineLabel}>{t("source")} · </Text>
          {sourceLine}
        </Text>
      )}
      {outputLine !== "" && (
        <Text style={st.line}>
          <Text style={st.lineLabel}>{t("output")} · </Text>
          {outputLine}
        </Text>
      )}
      {reasons.length > 0 && kind !== "direct" && (
        <View>
          <Pressable
            onPress={() => setShowReasons((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showReasons }}
            hitSlop={8}
            style={st.reasonsToggle}
          >
            <Text style={st.reasonsTxt}>{t(REASONS_KEY[kind])}</Text>
            <Feather name={showReasons ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.text.tertiary} />
          </Pressable>
          {showReasons && reasons.map((reason) => (
            <Text key={reason} style={st.reason}>• {t(`reason.${reason}`, { defaultValue: humanizeReason(reason) })}</Text>
          ))}
        </View>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { gap: 6 },
    chipRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, flexWrap: "wrap" as const },
    completion: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    line: { fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    lineLabel: { color: t.colors.text.tertiary },
    reasonsToggle: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, minHeight: 32, alignSelf: "flex-start" as const },
    reasonsTxt: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary },
    reason: { fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary, paddingLeft: 4 },
  });
