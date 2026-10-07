import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { settingsLicenseKey } from "@tentacle-tv/tv-core";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { SectionTitle, settingsText } from "./settingsParts";
import type { SettingsLicenses } from "./settingsTypes";

/**
 * Réglages › Licences : la mention de l'AGPL (copyright, absence de garantie,
 * source de cette version), puis une ligne par document — les composants
 * tiers, chaque texte de licence. OK ouvre le document dans le lecteur
 * (`LicenseReader`). C'est la copie de la licence qu'exigent la LGPL et
 * l'exception App Store de PrismCore : tout est embarqué, rien ne passe par
 * le réseau.
 */
export const LicensesPanel = memo(function LicensesPanel({ licenses, onOpen }: {
  licenses: SettingsLicenses;
  onOpen?: (index: number) => void;
}) {
  const { t } = useTranslation("about");
  return (
    <View style={styles.root}>
      <SectionTitle title={t("about:licensesTitle")} caption={licenses.statement} />
      <View style={styles.source}>
        <Text style={settingsText.label}>{t("about:sourceCode")}</Text>
        <Text style={settingsText.value}>{licenses.sourceUrl}</Text>
      </View>
      <View style={styles.rows}>
        {licenses.documents.map((doc, index) => (
          <FocusTarget
            key={doc.title}
            focusKey={settingsLicenseKey(index)}
            form="row"
            onPress={onOpen ? () => onOpen(index) : undefined}
            accessibilityLabel={`${doc.title}, ${doc.caption}`}
          >
            {(focused) => <Row title={doc.title} caption={doc.caption} focused={focused} />}
          </FocusTarget>
        ))}
      </View>
    </View>
  );
});

function Line({ title, caption, dark }: { title: string; caption: string; dark: boolean }) {
  return (
    <View style={styles.row}>
      <Icon name="list" size={28} color={dark ? colors.ctaFg : colors.textSecondary} strokeWidth={2.2} />
      <Text style={[styles.title, { color: dark ? colors.ctaFg : colors.text }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.caption, { color: dark ? scrim(0.62) : colors.textTertiary }]} numberOfLines={1}>{caption}</Text>
    </View>
  );
}

function Row({ title, caption, focused }: { title: string; caption: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.02 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.rowBox, lift]}>
      <Line title={title} caption={caption} dark={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>
        <Line title={title} caption={caption} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 28 },
  source: { gap: 6 },
  rows: { gap: 8 },
  rowBox: { borderRadius: 24, backgroundColor: white(0.06) },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 28 },
  title: { ...fonts.semibold, fontSize: 28, flex: 1 },
  caption: { ...fonts.medium, fontSize: 24 },
  focusFill: { borderRadius: 24, backgroundColor: colors.ctaBg },
});
