import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DownloadStatus } from "@tentacle-tv/offline-core";
import { FONT_FAMILY, RADIUS, typography, useTheme } from "@/theme";

interface Props {
  status: DownloadStatus;
  errorCode: string | null;
  /** Le transfert attend le Wi-Fi (pause système en données mobiles). */
  waitingWifi?: boolean;
}

/** Le badge d'état d'une ligne : En attente · En préparation · En pause · Prêt · Erreur · Annulé. */
export function OfflineStatusBadge({ status, errorCode, waitingWifi }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const pairs = colors.statusPairs;
  // Pas de paire « neutre » dans le thème : en attente et annulé prennent le remplissage discret.
  const neutral = { bg: colors.fill.subtle, fg: colors.text.secondary };

  let label: string;
  let pair: { bg: string; fg: string } = neutral;
  switch (status) {
    case "queued":
      label = waitingWifi ? to("stateWaitingWifi") : t("statusQueued");
      break;
    case "downloading":
      label = to("statusPreparing");
      pair = pairs.info;
      break;
    case "paused":
      label = waitingWifi ? to("stateWaitingWifi") : t("statusPaused");
      pair = pairs.warning;
      break;
    case "complete":
      label = to("statusReady");
      pair = pairs.success;
      break;
    case "error":
      label = errorCode === "disk-full" ? t("errorDiskFull") : t("statusError");
      pair = pairs.error;
      break;
    default:
      label = t("statusCanceled");
  }

  return (
    <View style={[styles.badge, { backgroundColor: pair.bg }]}>
      <Text style={[styles.text, { color: pair.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, alignSelf: "flex-start" },
  text: { ...typography.small, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.2 },
});
