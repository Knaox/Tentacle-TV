import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  channelsLabel, codecLabel, explainPlayback, humanizeReason, joinParts, rangeLabel, reasonKey, resolutionLabel,
  type AdminSessionDto, type DeliveryKind,
} from "@tentacle-tv/shared";
import { FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { DeliveryChip } from "./DeliveryChip";

const SHORT: Record<DeliveryKind, string> = {
  direct: "directPlayShort",
  remux: "remuxShort",
  audio: "audioTranscodeShort",
  video: "transcodeShort",
};

/**
 * Comment le média arrive à l'appareil, dit en clair — la même règle que le
 * bureau (`explainPlayback`) : la sorte et ce qu'elle veut dire, l'encodeur,
 * POURQUOI (chaque raison de Jellyfin en mots d'administrateur, toujours
 * visible), ce qui change, la source.
 */
export const PlaybackDetails = memo(function PlaybackDetails({ session }: { session: AdminSessionDto }) {
  const { t, i18n } = useTranslation("sessions");
  const st = useThemedStyles(makeStyles);
  const { kind, declaredTranscode, reasons, changes, encoder } = explainPlayback(session, i18n.language);
  const { source } = session;
  const completion = session.transcoding?.completionPercentage;

  const sourceLine = source
    ? joinParts([
        joinParts([codecLabel(source.videoCodec), resolutionLabel(source.width, source.height), rangeLabel(source.videoRange)]),
        joinParts([codecLabel(source.audioCodec), channelsLabel(source.audioChannels), source.audioLanguage?.toUpperCase()]),
        source.subtitle,
      ])
    : "";
  const what = joinParts([
    t(SHORT[kind]),
    // Le client se dit « Transcode » sans que Jellyfin encode rien : on le dit, sans l'en croire.
    declaredTranscode ? t("declaredTranscode") : null,
    encoder === null ? null : encoder === "software" ? t("software") : t("encoderHardware", { name: encoder }),
    completion !== undefined && kind !== "direct" ? t("completion", { percent: Math.round(completion) }) : null,
  ]);
  const reasonTexts = reasons.map((line) =>
    t(reasonKey(line), { ...line.params, defaultValue: humanizeReason(line.reason) }),
  );

  const row = (label: string, children: ReactNode) => (
    <View style={st.row}>
      <Text style={st.label}>{label}</Text>
      <View style={st.value}>{children}</View>
    </View>
  );

  return (
    <View style={st.root}>
      <View style={st.chipRow}>
        <DeliveryChip kind={kind} />
        <Text style={st.what}>{what}</Text>
      </View>
      {kind !== "direct" && row(
        t("why"),
        reasonTexts.length === 0
          ? <Text style={[st.text, st.muted]}>{t("whyUnknown")}</Text>
          : reasonTexts.map((text, i) => (
              <Text key={reasons[i].reason} style={st.text}>{reasonTexts.length > 1 ? `• ${text}` : text}</Text>
            )),
      )}
      {changes.length > 0 && row(t("changes"), <Text style={st.text}>{changes.join(" · ")}</Text>)}
      {sourceLine !== "" && row(t("source"), <Text style={st.text}>{sourceLine}</Text>)}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { gap: 6 },
    chipRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, flexWrap: "wrap" as const },
    what: { flexShrink: 1, fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    row: { flexDirection: "row" as const, gap: 10 },
    label: { width: 74, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    value: { flex: 1, minWidth: 0, gap: 2 },
    text: { fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    muted: { color: t.colors.text.tertiary },
  });
