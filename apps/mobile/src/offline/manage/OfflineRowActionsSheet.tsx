import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useUserId } from "@tentacle-tv/api-client";
import { i18n } from "@tentacle-tv/shared";
import { BottomSheet } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import {
  cancelTransfer,
  pauseTransfer,
  removeOfflineEntry,
  resumeTransfer,
  setAutoDeleteAfterWatch,
  type OfflineEntry,
} from "../engineApi";
import { AutoDeleteChips, type AutoDeleteValue } from "../keep/AutoDeleteChips";
import { scheduleText } from "./autoDeleteText";
import { entryTitle } from "./OfflineEntryRow";

interface Props {
  entry: OfflineEntry | null;
  onClose: () => void;
  onPlay: (entry: OfflineEntry) => void;
  /** « Plus d'infos » : la fiche locale du titre (absent : pas de ligne). */
  onInfo?: (entry: OfflineEntry) => void;
}

/**
 * La feuille « ⋯ » d'une ligne — et la feuille d'appui long du catalogue :
 * Lire, Plus d'infos, Pause / Reprendre / Annuler le transfert, Supprimer
 * après visionnage (avec l'échéance), et « Retirer de l'appareil » en rouge,
 * avec la confirmation multi-comptes.
 */
export function OfflineRowActionsSheet({ entry, onClose, onPlay, onInfo }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const userId = useUserId();
  const [busy, setBusy] = useState(false);

  const act = useCallback((fn: () => void) => () => { fn(); onClose(); }, [onClose]);

  const remove = useCallback(() => {
    if (!entry || userId === null) return;
    Alert.alert(to("removeConfirmTitle"), to("removeConfirmMessage"), [
      { text: t("cancel", { defaultValue: i18n.t("common:cancel") }), style: "cancel" },
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

  const onAutoDelete = useCallback((value: AutoDeleteValue) => {
    if (!entry || userId === null) return;
    setAutoDeleteAfterWatch(userId, entry.id, value !== null, value ?? 0);
  }, [entry, userId]);

  if (entry === null) return null;
  // « Annuler » vaut aussi pour une erreur définitive : sans ça, un titre que
  // le disque plein a arrêté ne pouvait plus être retiré de la file.
  const active =
    entry.status === "queued" ||
    entry.status === "downloading" ||
    entry.status === "paused" ||
    entry.status === "error";
  const autoDelete: AutoDeleteValue = entry.autoDeleteAfterWatch ? entry.autoDeleteDelayMinutes : null;

  const row = (icon: keyof typeof Feather.glyphMap, label: string, onPress: () => void, danger = false) => (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [st.row, pressed && st.pressed]}>
      <Feather name={icon} size={18} color={danger ? colors.status.error : colors.text.primary} />
      <Text style={[st.rowText, danger && { color: colors.status.error }]}>{label}</Text>
    </Pressable>
  );

  return (
    <BottomSheet visible onClose={onClose} snapPoints={[0.55, 0.9]}>
      <View style={st.body}>
        <Text style={st.title} numberOfLines={2}>{entryTitle(entry)}</Text>
        {entry.status === "complete" && row("play", entry.kind === "episode" ? t("episodePlay") : i18n.t("common:play"), act(() => onPlay(entry)))}
        {entry.status === "complete" && onInfo && row("info", i18n.t("common:moreInfo"), act(() => onInfo(entry)))}
        {(entry.status === "downloading" || entry.status === "queued") && row("pause", t("pause"), act(() => pauseTransfer(entry.id)))}
        {(entry.status === "paused" || entry.status === "error") && row("play", t("resume"), act(() => resumeTransfer(entry.id)))}
        {active && row("x-circle", t("cancelTransfer"), act(() => cancelTransfer(entry.id)))}
        {entry.status === "complete" && (
          <View style={st.autoDelete}>
            <AutoDeleteChips value={autoDelete} onChange={onAutoDelete} />
            {entry.deleteScheduledAt !== null && (
              <Text style={st.schedule}>{scheduleText(entry.deleteScheduledAt, t, i18n.language)}</Text>
            )}
          </View>
        )}
        <View style={st.divider} />
        {row("trash-2", to("remove"), remove, true)}
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: 4 },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, marginBottom: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: RADIUS.md },
    pressed: { backgroundColor: t.colors.fill.subtle },
    rowText: { ...typography.body, color: t.colors.text.primary },
    autoDelete: { paddingVertical: 10, paddingHorizontal: 10, gap: 8 },
    schedule: { ...typography.caption, color: t.colors.text.tertiary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border.subtle, marginVertical: 6 },
  });
