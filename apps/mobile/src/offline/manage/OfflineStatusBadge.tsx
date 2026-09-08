import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DownloadStatus } from "@tentacle-tv/offline-core";
import { FONT_FAMILY, RADIUS, typography, useTheme } from "@/theme";
import type { TransferWait } from "../transferGate";

interface Props {
  status: DownloadStatus;
  errorCode: string | null;
  /** Ce que la ligne attend (`transferWait`) : le Wi-Fi, le réseau, ou rien. */
  wait?: TransferWait;
  /** Étape hors transfert : `"finalize"` pendant le remux. */
  phase?: string | null;
}

/**
 * Les causes d'erreur, telles qu'elles sont écrites en base. `missing` et
 * `integrity` y étaient déjà posées par la lecture locale sans avoir jamais eu
 * de libellé : l'écran disait « Erreur », sans plus.
 */
const ERROR_KEYS: Record<string, string> = {
  "disk-full": "errorDiskFull",
  unavailable: "errorUnavailable",
  integrity: "errorIntegrity",
  missing: "errorMissing",
  io: "errorIo",
  unexpected: "errorUnexpected",
  // Le remux a rendu une image sans son : le fichier est jeté, la cause reste.
  audio: "errorAudio",
};

/**
 * Le badge d'état d'une ligne : En attente (du Wi-Fi, du réseau) · En
 * préparation · Finalisation · En pause · Prêt · la CAUSE d'une erreur ·
 * Annulé.
 */
export function OfflineStatusBadge({ status, errorCode, wait = null, phase = null }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const { colors } = useTheme();
  const pairs = colors.statusPairs;
  // Pas de paire « neutre » dans le thème : en attente et annulé prennent le remplissage discret.
  const neutral = { bg: colors.fill.subtle, fg: colors.text.secondary };

  const waiting = wait === "wifi" ? to("stateWaitingWifi") : wait === "network" ? to("stateWaitingNetwork") : null;
  let label: string;
  let pair: { bg: string; fg: string } = neutral;
  switch (status) {
    case "queued":
      label = waiting ?? t("statusQueued");
      break;
    case "downloading":
      // Le remux dure parfois des minutes après le dernier octet reçu : sans
      // libellé, la ligne semblait figée à 100 %.
      label = phase === "finalize" ? to("statusFinalizing") : to("statusPreparing");
      pair = pairs.info;
      break;
    case "paused":
      label = waiting ?? t("statusPaused");
      pair = pairs.warning;
      break;
    case "complete":
      label = to("statusReady");
      pair = pairs.success;
      break;
    case "error": {
      // La finalisation a sa clé dans `offline` : le mot y est interdit ailleurs.
      const key = errorCode === null ? undefined : ERROR_KEYS[errorCode];
      label =
        errorCode === "finalize" ? to("errorFinalize") : key === undefined ? t("statusError") : t(key);
      pair = pairs.error;
      break;
    }
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
