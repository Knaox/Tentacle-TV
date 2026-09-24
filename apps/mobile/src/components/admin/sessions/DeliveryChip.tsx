import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { DELIVERY_ORDER, countDeliveries, type AdminSessionDto, type DeliveryKind } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme } from "@/theme";

/**
 * La pastille qui dit comment le média arrive — une couleur par poids pour le
 * serveur, et TOUJOURS une icône et un mot : la couleur seule ne dit rien à
 * qui ne la distingue pas (les mêmes choix que le bureau).
 *
 * - lecture directe : vert, rien à surveiller ;
 * - remux : bleu — le serveur ne fait que réemballer, sans perte ;
 * - transcodage audio : l'aplat ambre, la famille du transcodage ;
 * - transcodage : le même aplat CERCLÉ d'ambre — le plus lourd, c'est lui que
 *   l'œil doit trouver d'abord.
 */

type Tone = "success" | "info" | "warning";

const STYLE: Record<DeliveryKind, { label: string; count: string; hint: string; icon: keyof typeof Feather.glyphMap; tone: Tone; ring?: true }> = {
  direct: { label: "directPlay", count: "countDirect", hint: "directPlayHint", icon: "check-circle", tone: "success" },
  remux: { label: "remux", count: "countRemux", hint: "remuxHint", icon: "package", tone: "info" },
  audio: { label: "audioTranscode", count: "countAudio", hint: "audioTranscodeHint", icon: "music", tone: "warning" },
  video: { label: "transcode", count: "countVideo", hint: "transcodeHint", icon: "cpu", tone: "warning", ring: true },
};

export const DeliveryChip = memo(function DeliveryChip({ kind, count, size = "md" }: {
  kind: DeliveryKind;
  /** Présent : la pastille devient un compteur (« 2 remux »). */
  count?: number;
  size?: "md" | "sm";
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const style = STYLE[kind];
  const pair = theme.colors.statusPairs[style.tone];
  const label = count === undefined ? t(style.label) : t(style.count, { count });
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityHint={t(style.hint)}
      style={[
        st.chip,
        size === "sm" ? st.sm : st.md,
        { backgroundColor: pair.bg },
        style.ring && { borderWidth: 1, borderColor: theme.colors.status.warning },
      ]}
    >
      <Feather name={style.icon} size={size === "sm" ? 11 : 12} color={pair.fg} />
      <Text style={[st.text, size === "sm" && st.textSm, { color: pair.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
});

/**
 * L'en-tête chiffré du tableau de bord : combien de lectures, et ce qu'elles
 * coûtent au serveur — une pastille par sorte présente, de la plus légère à
 * la plus lourde. Elle sert aussi de légende aux pastilles des cartes.
 */
export const SessionsSummary = memo(function SessionsSummary({ sessions }: { sessions: readonly AdminSessionDto[] }) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const counts = countDeliveries(sessions);
  const playing = DELIVERY_ORDER.reduce((sum, kind) => sum + counts[kind], 0);
  return (
    <View style={st.summary}>
      <Text style={[st.playing, { color: theme.colors.text.secondary }]}>{t("playingCount", { count: playing })}</Text>
      {DELIVERY_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
        <DeliveryChip key={kind} kind={kind} count={counts[kind]} size="sm" />
      ))}
    </View>
  );
});

const st = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: RADIUS.pill },
  md: { height: 28, gap: 6, paddingHorizontal: 10 },
  sm: { height: 24, gap: 4, paddingHorizontal: 8 },
  text: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.2, fontVariant: ["tabular-nums"] },
  textSm: { fontSize: 11 },
  summary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  playing: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"], marginRight: 4 },
});
