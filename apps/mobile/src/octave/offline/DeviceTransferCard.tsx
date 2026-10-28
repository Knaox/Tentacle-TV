/**
 * Octave (mobile) — la carte des TRANSFERTS en tête de « Sur cet appareil » :
 * « on sait que ça transfère, mais pas où ça en est » (Damien, 28/10). Le
 * pourcentage du lot en grand, la barre au dégradé de marque, « 12 sur 30
 * titres · 84 Mo sur 210 Mo », le temps restant d'après le débit MESURÉ, puis les
 * gestes sur la file d'Octave et la file elle-même. Absente quand rien ne bouge.
 *
 * Une coupure que le moteur relance seul se DIT (« Ça n'avance plus… ») au
 * lieu de laisser le temps restant figé.
 *
 * Le pourcentage n'est jamais seul : la barre a sa valeur pour les lecteurs
 * d'écran, l'état se dit en mots (« En pause », « 2 titres en défaut »).
 */

import { memo, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { ProgressBar } from "@/components/ui";
import { formatBytes } from "@/offline/formatBytes";
import { formatRate, formatTimeLeft } from "@/offline/formatTransfer";
import { useTheme } from "@/theme";
import { useOctaveColors } from "../theme/octaveColors";
import { pauseQueue, queueHasMoving, queueHasUserPaused, resumeQueue, retryFailed } from "./transferGestures";
import type { KeptTransferSummary } from "./transferModel";
import { TransferQueue } from "./TransferQueue";

/** Ce que la deuxième ligne dit : le temps restant, la mesure en cours, ou la pause. */
function paceText(s: KeptTransferSummary, t: (key: string, o?: Record<string, unknown>) => string): string | null {
  if (s.running === 0) return s.pausedByUser > 0 ? t("transfers.pausedHint") : null;
  if (s.stalled) return null;
  const time = formatTimeLeft(s.etaMs);
  if (time === null) return t("transfers.measuring");
  const rate = formatRate(s.rateBps);
  const left = s.estimated ? t("transfers.timeAbout", { time }) : time;
  return rate ? `${left} · ${rate}` : left;
}

export const DeviceTransferCard = memo(function DeviceTransferCard({ summary }: { summary: KeptTransferSummary }) {
  const { t } = useTranslation("musicOffline");
  const { t: to } = useTranslation("offline");
  const colors = useOctaveColors();
  const { colors: theme } = useTheme();
  if (!summary.active) return null;

  const percent = Math.floor(summary.fraction * 100);
  const title = summary.running > 0 ? t("transfers.title") : summary.pausedByUser > 0 ? t("transfers.titlePaused") : t("transfers.titleFailed");
  const count = t("transfers.count", { done: summary.done, total: summary.total });
  const bytes = summary.bytesTotal === null ? null : t(summary.estimated ? "transfers.bytesAbout" : "transfers.bytes", { done: formatBytes(summary.bytesDone), total: formatBytes(summary.bytesTotal) });
  const pace = paceText(summary, t);
  const moving = queueHasMoving(summary.queue);
  const userPaused = queueHasUserPaused(summary.queue);

  return (
    <View style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
        <Text style={[styles.percent, { color: colors.accentText }]} accessibilityElementsHidden importantForAccessibility="no">{percent} %</Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("transfers.progressLabel")}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} %, ${count}` }}
      >
        <ProgressBar progress={summary.fraction} height={6} showEmpty />
      </View>
      <Text style={[styles.line, { color: colors.textSecondary }]}>{bytes ? `${count} · ${bytes}` : count}</Text>
      {pace !== null && <Text style={[styles.line, { color: colors.textTertiary }]}>{pace}</Text>}
      {summary.stalled && (
        <View style={styles.failed} accessibilityLiveRegion="polite">
          <Feather name="wifi-off" size={14} color={theme.statusPairs.warning.fg} />
          <Text style={[styles.line, styles.flex, { color: theme.statusPairs.warning.fg }]}>{t("transfers.stalled")}</Text>
        </View>
      )}
      {summary.failed > 0 && (
        <View style={styles.failed}>
          <Feather name="alert-triangle" size={14} color={theme.statusPairs.error.fg} />
          <Text style={[styles.line, { color: theme.statusPairs.error.fg }]}>{t("transfers.failed", { count: summary.failed })}</Text>
        </View>
      )}
      <View style={styles.actions}>
        {moving && <Chip icon="pause" label={to("pauseAll")} onPress={() => pauseQueue(summary.queue)} />}
        {!moving && userPaused && <Chip icon="play" label={to("resumeAll")} onPress={() => resumeQueue(summary.queue)} />}
        {summary.failed > 0 && <Chip icon="rotate-cw" label={to("retryAll")} onPress={() => retryFailed(summary.queue)} />}
      </View>
      <TransferQueue queue={summary.queue} />
    </View>
  );
});

function Chip({ icon, label, onPress }: { icon: ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void }) {
  const colors = useOctaveColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? colors.line : colors.pressed }]}
    >
      <Feather name={icon} size={15} color={colors.text} />
      <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8, marginBottom: 20 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  percent: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  line: { fontSize: 14, lineHeight: 19, fontVariant: ["tabular-nums"] },
  failed: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  // 44 pt : la cible tactile minimale.
  chip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 22 },
  chipText: { fontSize: 15, fontWeight: "600" },
});
