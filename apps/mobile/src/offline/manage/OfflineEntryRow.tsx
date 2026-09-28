import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { REMUX_PRESET } from "@tentacle-tv/offline-core";
import { useFileProgress } from "@tentacle-tv/offline-core/react";
import { ProgressBar } from "@/components/ui";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { pauseTransfer, resumeTransfer, type OfflineEntry } from "../engineApi";
import { entryTitle } from "../entryTitle";
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
  /** Dans la section d'une série, son nom au-dessus de chaque épisode est du bruit. */
  hideSeries?: boolean;
}

/** Le libellé de variante d'une entrée : Qualité d'origine · Qualité d'origine (MP4) · Allégé 720p. */
export function variantLabel(entry: OfflineEntry, t: (key: string) => string, to: (key: string) => string): string {
  if (entry.variant === "original") return to("variantOriginal");
  if (entry.preset === REMUX_PRESET) return to("variantRemux");
  return `${t("variantLight")} ${entry.preset?.replace(/^p/, "") ?? ""}p`;
}

/**
 * Une ligne de l'écran de gestion : affiche locale, titre, méta, badge,
 * barre de progression en direct (magasin de progression, hors TanStack),
 * action rapide selon l'état et « ⋯ » vers la feuille d'actions.
 */
export function OfflineEntryRow({ entry, onPlay, onMore, wait = null, selection, hideSeries = false }: Props) {
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

  // Un side-car qui n'est pas arrivé — extraction trop lente côté serveur —
  // ne se perd plus en silence : la ligne le dit, et la réparation le rattrape
  // au retour du réseau.
  const subsMissing =
    complete && entry.subtitlesDone !== null && entry.subtitlesDone < entry.subtitlesExpected
      ? { done: entry.subtitlesDone, total: entry.subtitlesExpected }
      : null;

  const quick = complete
    ? { icon: "play" as const, label: entry.kind === "episode" ? t("episodePlay") : to("stateOnDevice"), onPress: () => onPlay(entry) }
    : entry.status === "downloading" || entry.status === "queued"
      ? { icon: "pause" as const, label: t("pause"), onPress: () => pauseTransfer(entry.id) }
      : entry.status === "paused"
        ? { icon: "play" as const, label: t("resume"), onPress: () => resumeTransfer(entry.id) }
        : null;
  // Un échec se relance par « Réessayer » en toutes lettres : l'icône lecture
  // seule ne disait pas qu'elle relançait un transfert tombé.
  const retry = entry.status === "error" ? () => resumeTransfer(entry.id) : null;

  const body = (
    <View style={[st.row, entry.status === "error" && st.rowError, selection?.selected && st.rowSelected]}>
      {selection && (
        <View style={[st.check, selection.selected && st.checkOn]}>
          {selection.selected && <Feather name="check" size={14} color={colors.cta.brandFg} />}
        </View>
      )}
      <View style={st.poster}>
        {/* Sous l'image : sans affiche locale, un repère plutôt qu'un trou. */}
        <Feather name="film" size={16} color={colors.text.quaternary} />
        <OfflineLocalImage itemId={entry.itemId} candidates={["primary.jpg", "series-primary.jpg"]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={st.body}>
        {entry.kind === "episode" && entry.seriesName && !hideSeries ? <Text style={st.series} numberOfLines={1}>{entry.seriesName}</Text> : null}
        <Text style={st.title} numberOfLines={2}>{entryTitle(entry)}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
        <View style={st.badgeRow}>
          <OfflineStatusBadge status={entry.status} errorCode={entry.errorCode} wait={wait} phase={entry.phase} />
          {retryIn !== null && (
            <Text style={st.retry} numberOfLines={1}>
              {retryIn > 0 ? to("retryIn", { seconds: retryIn }) : to("retryNow")}
            </Text>
          )}
          {subsMissing !== null && (
            <Text style={st.retry} numberOfLines={1}>{to("subtitlesPartial", subsMissing)}</Text>
          )}
        </View>
        {active && (
          <View style={st.progressRow}>
            {/* Pas de repli : une barre inventée mentait sur l'avancement. Le
                dégradé de marque en transfert ; en pause un aplat neutre, en
                échec du rouge — l'état se lit aussi sur la barre. */}
            <ProgressBar
              progress={(pct ?? 0) / 100}
              height={4}
              showEmpty
              style={st.track}
              tint={entry.status === "error" ? colors.status.error : entry.status === "paused" ? colors.fill.strong : undefined}
            />
            <Text style={st.progressText}>
              {formatBytes(bytesDone)}{expected ? ` / ${formatBytes(expected)}` : ""}
            </Text>
          </View>
        )}
        {pace.length > 0 && <Text style={st.pace} numberOfLines={1}>{pace}</Text>}
        {/* Sous la barre, pas dans la colonne d'actions : là, il écrasait le
            titre et la barre de la ligne en échec. */}
        {retry && !selection && (
          <Pressable onPress={retry} hitSlop={6} accessibilityRole="button" accessibilityLabel={to("retry")} style={({ pressed }) => [st.retryBtn, pressed && { opacity: 0.7 }]}>
            <Feather name="rotate-cw" size={13} color={colors.brand.light} />
            <Text style={st.retryText}>{to("retry")}</Text>
          </Pressable>
        )}
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
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.faint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    rowError: { borderColor: t.colors.statusPairs.error.bg },
    rowSelected: { backgroundColor: withAlpha(t.colors.brand.violet, 0.12, t.colors.brand.soft), borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow) },
    check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: t.colors.border.strong, alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: t.colors.brand.violet, borderColor: t.colors.brand.violet },
    poster: {
      width: 44,
      height: 66,
      borderRadius: RADIUS.sm,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface.s2,
    },
    body: { flex: 1, gap: 2 },
    series: { ...typography.small, color: t.colors.brand.light, fontFamily: FONT_FAMILY.medium },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, fontSize: 14, lineHeight: 18 },
    meta: { ...typography.small, color: t.colors.text.quaternary },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    track: { flex: 1, backgroundColor: t.colors.fill.subtle },
    retryBtn: {
      alignSelf: "flex-start",
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: RADIUS.pill,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.16, t.colors.brand.soft),
    },
    retryText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    progressText: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"], minWidth: 88, textAlign: "right" },
    pace: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"], marginTop: 2 },
    retry: { ...typography.small, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    actions: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  });
