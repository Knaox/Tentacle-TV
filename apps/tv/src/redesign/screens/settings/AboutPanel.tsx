import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { colors, fonts } from "../../theme/tokens";
import { settingsText } from "./settingsParts";
import type { SettingsAbout } from "./settingsTypes";

/**
 * À propos — ce qu'on vient lire quand quelque chose ne va pas : la version,
 * le serveur, le compte, l'appareil ; puis ce que fait l'application, la
 * licence (la mention qu'exige l'exception App Store de PrismCore) et le
 * copyright. RIEN n'y est focalisable : la page n'agit pas, l'onglet la
 * porte. Deux colonnes, pour tout tenir sans défiler.
 */

const FEATURE_KEYS = ["featurePlayer", "featureResume", "featureRequests", "featureAdaptive", "featureNotifications"] as const;

export const AboutPanel = memo(function AboutPanel({ about }: { about: SettingsAbout }) {
  const { t } = useTranslation(["about", "pairing"]);
  const infos: Array<[string, string]> = [
    [t("pairing:tvServeur"), about.serverUrl],
    [t("pairing:tvCompteJumele"), about.userName],
    [t("pairing:tvPlateforme"), about.deviceLabel],
  ];
  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <View style={styles.identity}>
          <BrandMark size={96} />
          <View style={styles.identityText}>
            <Text style={styles.appName}>Tentacle TV</Text>
            <Text style={settingsText.hint}>{t("about:version", { version: about.version })}</Text>
          </View>
        </View>
        <View style={styles.infos}>
          {infos.map(([label, value]) => (
            <View key={label} style={styles.info}>
              <Text style={settingsText.label} numberOfLines={1}>{label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
            </View>
          ))}
        </View>
        <View>
          <Text style={[settingsText.label, styles.blockLabel]}>{t("about:features")}</Text>
          <View style={styles.features}>
            {FEATURE_KEYS.map((key) => (
              <View key={key} style={styles.feature}>
                <View style={styles.bullet} />
                <Text style={styles.featureText}>{t(`about:${key}`)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.description}>{t("about:description")}</Text>
        <View>
          <Text style={[settingsText.label, styles.blockLabel]}>{t("about:license")}</Text>
          <Text style={styles.license}>{t("about:licenseTextTv")}</Text>
        </View>
        <Text style={settingsText.small}>{t("about:copyright", { version: about.version, year: about.year })}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flexDirection: "row", gap: 52 },
  left: { width: 500, gap: 34 },
  right: { flex: 1, gap: 30 },
  identity: { flexDirection: "row", alignItems: "center", gap: 24 },
  identityText: { gap: 4 },
  appName: { ...fonts.extrabold, fontSize: 44, lineHeight: 52, letterSpacing: -0.6, color: colors.text },
  infos: { gap: 16 },
  info: { gap: 4 },
  infoValue: { ...fonts.semibold, fontSize: 26, lineHeight: 34, color: colors.text },
  blockLabel: { marginBottom: 12 },
  features: { gap: 10 },
  feature: { flexDirection: "row", gap: 14 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 13, backgroundColor: colors.accent },
  featureText: { ...fonts.regular, flex: 1, fontSize: 24, lineHeight: 32, color: colors.textSecondary },
  description: { ...fonts.regular, fontSize: 26, lineHeight: 36, color: colors.textSecondary },
  license: { ...fonts.regular, fontSize: 22, lineHeight: 30, color: colors.textTertiary },
});
