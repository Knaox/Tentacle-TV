import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { REMUX_PRESET } from "@tentacle-tv/offline-core";
import { useFileProgress } from "@tentacle-tv/offline-core/react";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { pauseTransfer, resumeTransfer, type OfflineEntry } from "../engineApi";
import { formatBytes } from "../formatBytes";
import { formatRate, formatTimeLeft } from "../formatTransfer";
import type { TransferWait } from "../transferGate";
import { OfflineLocalImage } from "../library/OfflineLocalImage";
import { OfflineStatusBadge } from "./OfflineStatusBadge";
import { useRetryCountdown } from "./useRetryCountdown";

const ACTIVE = new Set(["queued", "downloading", "paused"]);

interface Props {
  entry: OfflineEntry;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
  /** Ce que la ligne attend (`transferWait`) : le Wi-Fi, le réseau, ou rien. */
  wait?: TransferWait;
  /** Mode sélection : la ligne porte une case et bascule au toucher. */
  selection?: { selected: boolean; onToggle: (fileId: number) => void };
}

/** Le libellé de variante d'une entrée : Qualité d'origine · Qualité d'origine (MP4) · Allégé 720p. */
export function variantLabel(entry: OfflineEntry, t: (key: string) => string, to: (key: string) => string): string {
  if (entry.variant === "original") return to("variantOriginal");
  if (entry.preset === REMUX_PRESET) return to("variantRemux");
  return `${t("variantLight")} ${entry.preset?.replace(/^p/, "") ?? ""}p`;
}

export function entryTitle(entry: OfflineEntry): string {
  const code = entry.kind === "episode" && entry.indexNumber != null
    ? `S${String(entry.parentIndexNumber ?? 1).padStart(2, "0")}E${String(entry.indexNumber).padStart(2, "0")} · `
    : "";
  return `${code}${entry.title ?? entry.itemId}`;
}

/**
 * Une ligne de l'écran de gestion : affiche locale, titre, méta, badge,
 * barre de progression en direct (magasin de progression, hors TanStack),
 * action rapide selon l'état et « ⋯ » vers la feuille d'actions.
 */
export function OfflineEntryRow({ entry, onPlay, onMore, wait = null, selection }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const live = useFileProgress(entry.id);

  const retryIn = useRetryCountdown(entry.status === "error" ? entry.nextRetryAt : null);

  const finalizing = entry.phase === "finalize";
  const bytesDone = live?.bytesDone ?? entry.bytesDone;
  const expected = live?.expectedSize ?? entry.expectedSize;
  // Le remux vient APRÈS le dernier octet : la barre est pleine, elle attend.
  const pct = finalizing ? 100 : expected && expected > 0 ? Math.min(100, (bytesDone / expected) * 100) : null;
  const active = ACTIVE.has(entry.status) || entry.status === "error";
  // Débit et temps restant n'ont de sens que pendant un transfert qui avance.
  const rate = entry.status === "downloading" && !finalizing ? formatRate(live?.rateBps ?? null) : null;
  const timeLeft = entry.status === "downloading" && !finalizing ? formatTimeLeft(live?.etaMs ?? null) : null;
  const pace = [rate, timeLeft].filter(Boolean).join(" · ");
  const complete = entry.status === "complete";

  const meta = [variantLabel(entry, t, to), complete ? formatBytes(entry.bytesDone) : expected ? formatBytes(expected) : null]
    .filter(Boolean)
    .join(" · ");

  const quick = complete
    ? { icon: "play" as const, label: entry.kind === "episode" ? t("episodePlay") : to("stateOnDevice"), onPress: () => onPlay(entry) }
    : entry.status === "downloading" || entry.status === "queued"
      ? { icon: "pause" as const, label: t("pause"), onPress: () => pauseTransfer(entry.id) }
      : entry.status === "paused" || entry.status === "error"
        ? { icon: "play" as const, label: t("resume"), onPress: () => resumeTransfer(entry.id) }
        : null;

  const body = (
    <View style={[st.row, selection?.selected && st.rowSelected]}>
      {selection && (
        <View style={[st.check, selection.selected && st.checkOn]}>
          {selection.selected && <Feather name="check" size={14} color={colors.cta.brandFg} />}
        </View>
      )}
      <View style={st.poster}>
        <OfflineLocalImage itemId={entry.itemId} candidates={["primary.jpg", "series-primary.jpg"]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={st.body}>
        {entry.kind === "episode" && entry.seriesName ? <Text style={st.series} numberOfLines={1}>{entry.seriesName}</Text> : null}
        <Text style={st.title} numberOfLines={2}>{entryTitle(entry)}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
        <View style={st.badgeRow}>
          <OfflineStatusBadge status={entry.status} errorCode={entry.errorCode} wait={wait} phase={entry.phase} />
          {retryIn !== null && (
            <Text style={st.retry} numberOfLines={1}>
              {retryIn > 0 ? to("retryIn", { seconds: retryIn }) : to("retryNow")}
            </Text>
          )}
        </View>
        {active && (
          <View style={st.progressRow}>
            <View style={st.track}>
              {/* Pas de repli : une barre inventée mentait sur l'avancement. */}
              <View style={[st.fill, { width: `${pct ?? 0}%` }]} />
            </View>
            <Text style={st.progressText}>
              {formatBytes(bytesDone)}{expected ? ` / ${formatBytes(expected)}` : ""}
            </Text>
          </View>
        )}
        {pace.length > 0 && <Text style={st.pace} numberOfLines={1}>{pace}</Text>}
      </View>
      {!selection && (
        <View style={st.actions}>
          {quick && (
            <Pressable onPress={quick.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={quick.label} style={st.iconBtn}>
              <Feather name={quick.icon} size={18} color={colors.text.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => onMore(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel={to("manage")} style={st.iconBtn}>
            <Feather name="more-horizontal" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
      )}
    </View>
  );

  if (selection) {
    return (
      <Pressable onPress={() => selection.onToggle(entry.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selection.selected }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.faint },
    rowSelected: { backgroundColor: withAlpha(t.colors.brand.violet, 0.12, t.colors.brand.soft) },
    check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: t.colors.border.strong, alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: t.colors.brand.violet, borderColor: t.colors.brand.violet },
    poster: { width: 44, height: 66, borderRadius: RADIUS.sm, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
    body: { flex: 1, gap: 2 },
    series: { ...typography.small, color: t.colors.brand.light, fontFamily: FONT_FAMILY.medium },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, fontSize: 14, lineHeight: 18 },
    meta: { ...typography.small, color: t.colors.text.quaternary },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    track: { flex: 1, height: 4, borderRadius: RADIUS.pill, backgroundColor: t.colors.fill.subtle, overflow: "hidden" },
    fill: { height: "100%", backgroundColor: t.colors.brand.violet },
    progressText: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"], minWidth: 88, textAlign: "right" },
    pace: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"], marginTop: 2 },
    retry: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  });
