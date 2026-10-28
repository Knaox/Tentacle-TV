/** Octave (mobile) — rien sur ce téléphone : ce qui se garde, et comment (jamais un écran muet). */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { useOctaveColors } from "../theme/octaveColors";

export const DeviceEmpty = memo(function DeviceEmpty() {
  const colors = useOctaveColors();
  const { t } = useTranslation("musicOffline");
  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <KeptGlyph size={30} color={colors.accentText} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t("view.empty")}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{t("view.emptyHint")}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 56, gap: 12, paddingHorizontal: 24 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  hint: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 420 },
});
