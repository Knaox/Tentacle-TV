import { useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet, Button } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import { setManualOffline, type NetworkType } from "./connectivityStore";
import { offlineReasonKey } from "./offlineReasonText";
import { useConnectivity } from "./useConnectivity";
import { useProbeRetry } from "./useProbeRetry";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const NETWORK_KEYS: Partial<Record<NetworkType, string>> = {
  wifi: "networkWifi",
  cellular: "networkCellular",
  none: "networkNone",
  other: "networkOther",
};

/**
 * La bulle de la pastille « Hors ligne » : la cause (serveur Tentacle ou
 * Jellyfin), le réseau du téléphone, le rappel du retour automatique, et les
 * actions — Réessayer et Rester hors ligne, ou Repasser en ligne en manuel.
 */
export function ConnectivitySheet({ visible, onClose }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const snap = useConnectivity();
  const st = useThemedStyles(makeStyles);
  const { isChecking, retry } = useProbeRetry();

  const offline = snap.state === "offline-auto" || snap.state === "offline-manual";
  const manual = snap.state === "offline-manual";

  // Le retour en ligne ferme la bulle : il n'y a plus rien à y dire.
  useEffect(() => {
    if (visible && !offline) onClose();
  }, [visible, offline, onClose]);

  const stayOffline = useCallback(() => {
    onClose();
    setManualOffline(true);
  }, [onClose]);

  const goOnline = useCallback(() => {
    onClose();
    setManualOffline(false);
  }, [onClose]);

  const networkKey = NETWORK_KEYS[snap.networkType];
  const description = manual
    ? `${t("offlineManualEnabled")} ${snap.reachable ? t("offlineServerReachable") : t("offlineServerUnreachable")}`
    : t(offlineReasonKey(snap.reason));

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.42, 0.6]}>
      <View style={st.body}>
        <Text style={st.title} accessibilityRole="header">{t("offlinePopoverTitle")}</Text>
        <Text style={st.text}>{description}</Text>
        {networkKey && (
          <Text style={st.text}>{to("networkLabel", { type: to(networkKey) })}</Text>
        )}
        {!manual && <Text style={st.hint}>{t("offlineAutoHint")}</Text>}
        <View style={st.actions}>
          {manual ? (
            <Button title={t("offlineGoOnline")} onPress={goOnline} fullWidth />
          ) : (
            <>
              <Button title={t("offlineRetry")} onPress={retry} loading={isChecking} fullWidth />
              <Button title={t("offlineStayOffline")} onPress={stayOffline} variant="secondary" fullWidth />
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    text: { ...typography.body, color: t.colors.text.secondary, lineHeight: 20 },
    hint: { ...typography.caption, color: t.colors.text.quaternary, lineHeight: 17 },
    actions: { gap: spacing.sm, marginTop: spacing.md },
  });
