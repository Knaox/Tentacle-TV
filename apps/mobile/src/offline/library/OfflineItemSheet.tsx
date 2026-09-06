import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useUserId } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { watchStateOf } from "@tentacle-tv/offline-core";
import { BottomSheet, Button, ProgressBar } from "@/components/ui";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import { removeOfflineEntry, type OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { scheduleText } from "@/offline/manage/autoDeleteText";
import { variantLabel } from "@/offline/manage/OfflineEntryRow";
import { spacing, typography, FONT_FAMILY, RADIUS, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";

interface Props {
  entry: OfflineEntry | null;
  onClose: () => void;
  onPlay: (entry: OfflineEntry) => void;
}

/** La bannière du titre, sinon sa vignette (un épisode n'a souvent que la seconde). */
const BANNER_ART = ["backdrop.jpg", "primary.jpg"] as const;

/**
 * La fiche d'un titre gardé sur l'appareil : bannière et synopsis lus dans le
 * snapshot, la ligne de métadonnées (série — code · année · durée · version ·
 * taille), la reprise, l'échéance d'auto-suppression, puis Lire et « Retirer
 * de l'appareil ». Rien ici ne touche le réseau.
 */
export function OfflineItemSheet({ entry, onClose, onPlay }: Props) {
  const { t, i18n } = useTranslation(["offline", "downloads", "common"]);
  const st = useThemedStyles(makeStyles);
  const userId = useUserId();
  const [busy, setBusy] = useState(false);
  const { data: item } = useLocalSnapshotJson<MediaItem>(entry?.itemId, "item.json");
  const to = useCallback((key: string) => t(`offline:${key}`), [t]);
  const td = useCallback((key: string) => t(`downloads:${key}`), [t]);

  const remove = useCallback(() => {
    if (!entry || userId === null) return;
    Alert.alert(to("removeConfirmTitle"), to("removeConfirmMessage"), [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: to("remove"),
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void removeOfflineEntry(userId, entry.id).finally(() => { setBusy(false); onClose(); });
        },
      },
    ]);
  }, [entry, userId, t, to, onClose]);

  if (entry === null) return null;

  const title = item?.Name ?? entry.title ?? entry.itemId;
  // Numéros du snapshot, sinon ceux de la base locale (snapshot non récupéré).
  const seasonNumber = item?.ParentIndexNumber ?? entry.parentIndexNumber;
  const episodeNumber = item?.IndexNumber ?? entry.indexNumber;
  const code = entry.kind === "episode" && seasonNumber != null && episodeNumber != null
    ? formatEpisodeCode(seasonNumber, episodeNumber, { style: "padded" })
    : null;
  const meta = [
    entry.seriesName && code ? `${entry.seriesName} — ${code}` : null,
    item?.ProductionYear ? String(item.ProductionYear) : null,
    formatDuration(item?.RunTimeTicks ?? entry.runtimeTicks ?? undefined),
    variantLabel(entry, td, to),
    formatBytes(entry.bytesDone),
  ].filter(Boolean).join(" · ");
  const overview = (item?.Overview ?? "").replace(/<[^>]+>/g, "").trim();
  const { watched, percent } = watchStateOf(entry);
  const resumable = !watched && percent !== null && percent > 0;

  return (
    <BottomSheet visible onClose={onClose} snapPoints={[0.64, 0.94]}>
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <View style={st.banner}>
          <OfflineLocalImage itemId={entry.itemId} candidates={BANNER_ART} style={StyleSheet.absoluteFill} />
          {resumable && (
            <View style={st.progWrap}>
              <ProgressBar progress={percent / 100} height={3} />
            </View>
          )}
        </View>
        <Text style={st.title} numberOfLines={2}>{title}</Text>
        {meta.length > 0 && <Text style={st.meta}>{meta}</Text>}
        {overview.length > 0 && <Text style={st.overview} numberOfLines={6}>{overview}</Text>}
        {entry.deleteScheduledAt !== null && (
          <Text style={st.schedule}>{scheduleText(entry.deleteScheduledAt, td, i18n.language)}</Text>
        )}
        <View style={st.actions}>
          <Button
            title={resumable ? td("resume") : entry.kind === "episode" ? td("episodePlay") : t("common:play")}
            onPress={() => onPlay(entry)}
            disabled={busy}
            fullWidth
          />
          <Button title={to("remove")} onPress={remove} variant="danger" loading={busy} fullWidth />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    banner: {
      aspectRatio: 16 / 9,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      marginBottom: spacing.xs,
    },
    progWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    meta: { ...typography.caption, color: t.colors.text.tertiary },
    overview: { ...typography.body, color: t.colors.text.secondary, lineHeight: 21, marginTop: spacing.xs },
    schedule: { ...typography.caption, color: t.colors.text.tertiary },
    actions: { gap: spacing.sm, marginTop: spacing.md },
  });
