/**
 * Octave (mobile) — la page d'ATTENTE d'un écran pas encore branché dans le
 * registre : la vraie coquille autour (en-tête, marges), un mot sobre au milieu.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Music2 } from "lucide-react-native";
import { OctavePage } from "../layout/OctavePage";
import { useOctaveColors } from "../theme/octaveColors";

export const OctavePlaceholder = memo(function OctavePlaceholder({ title }: { title: string }) {
  const colors = useOctaveColors();
  const { t } = useTranslation("octaveShell");
  return (
    <OctavePage title={title}>
      <View style={styles.body}>
        <Music2 size={40} color={colors.accentText} strokeWidth={1.6} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t("mobile.soon")}</Text>
      </View>
    </OctavePage>
  );
});

const styles = StyleSheet.create({
  body: { alignItems: "center", justifyContent: "center", paddingVertical: 96, gap: 16 },
  text: { fontSize: 15, textAlign: "center" },
});
