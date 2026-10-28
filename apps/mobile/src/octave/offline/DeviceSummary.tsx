/**
 * Octave (mobile) — la tête de « Sur cet appareil » : combien, quelle place, la
 * place LIBRE ; les transferts en cours (`DeviceTransferCard`) ; la bascule du
 * mode hors ligne, qui dit aussi pourquoi on l'est (jamais un voile) ; en ligne,
 * la tenue à jour des playlists gardées (le réglage d'appareil d'Octave, allumé par défaut).
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SwitchRow } from "../settings/view/SwitchRow";
import { octaveAutoSync } from "../settings/octaveSettings";
import { useOctaveColors } from "../theme/octaveColors";
import { DeviceTransferCard } from "./DeviceTransferCard";
import { OfflineModeSwitch } from "./OfflineModeSwitch";
import { useOfflineSurface } from "./musicOfflineContext";
import { useKeptTransferSummary } from "./useKeptTransfers";

interface Props {
  summary: string | null;
  free: string | null;
  offline: boolean;
  /** Le compte peut garder : la tenue à jour a un sens. */
  canKeep: boolean;
}

export const DeviceSummary = memo(function DeviceSummary({ summary, free, offline, canKeep }: Props) {
  const colors = useOctaveColors();
  const { t } = useTranslation("musicOffline");
  const autoSync = octaveAutoSync.use();
  const transfers = useKeptTransferSummary();
  // Le hors ligne est au COMPTE DE L'APPAREIL : une session de profil n'en voit ni transferts ni bascule.
  const surface = useOfflineSurface();
  return (
    <View style={styles.wrap}>
      {summary !== null && <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text>}
      {free !== null && <Text style={[styles.free, { color: colors.textTertiary }]}>{t("view.freeOnDevice", { size: free })}</Text>}
      {surface.visible && (
        <View style={styles.block}>
          <DeviceTransferCard summary={transfers} />
          <OfflineModeSwitch />
        </View>
      )}
      {!offline && canKeep && (
        <View style={styles.setting}>
          <SwitchRow icon="refresh-cw" label={t("autosync.label")} description={t("autosync.hint")} value={autoSync} onChange={octaveAutoSync.set} last />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 20 },
  summary: { fontSize: 15, fontVariant: ["tabular-nums"] },
  free: { fontSize: 13, fontVariant: ["tabular-nums"] },
  block: { marginTop: 12 },
  setting: { marginTop: 8 },
});
