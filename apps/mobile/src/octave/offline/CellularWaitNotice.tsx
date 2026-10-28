/**
 * Octave (mobile) — « Le transfert sur données cellulaires est désactivé — L'activer » : une ligne discrète
 * sous « Sur cet appareil », quand des titres attendent le Wi-Fi (`cellularWaitRule.ts`). Le lien ALLUME le
 * réglage d'appareil « Transférer sur données cellulaires » (clé `wifi_only`, partagée avec Tentacle) : la file
 * repart aussitôt (`OfflineRuntimeSync`). Jamais une erreur, jamais un voile.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { setWifiOnly } from "@/offline/settings";
import { useTransferWaitContext, wifiBlocked } from "@/offline/transferGate";
import { useOctaveColors } from "../theme/octaveColors";
import { cellularWaitCount } from "./cellularWaitRule";
import { useKeptMusic } from "./useKeptMusic";

const enableCellular = (): void => setWifiOnly(false);

export const CellularWaitNotice = memo(function CellularWaitNotice() {
  const { t } = useTranslation("offline");
  const colors = useOctaveColors();
  const kept = useKeptMusic();
  const waiting = cellularWaitCount(kept.tracks, wifiBlocked(useTransferWaitContext()));
  if (waiting === 0) return null;
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={14} color={colors.textTertiary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {t("cellularOffNotice")}
        {" — "}
      </Text>
      <Pressable onPress={enableCellular} accessibilityRole="button" hitSlop={10}>
        <Text style={[styles.text, styles.link, { color: colors.text }]}>{t("cellularOffEnable")}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
  text: { fontSize: 13 },
  link: { fontWeight: "600", textDecorationLine: "underline" },
});
