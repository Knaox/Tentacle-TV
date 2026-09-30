import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { Chip } from "../../controls/Chip";
import { PillButton } from "../../controls/PillButton";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { Glow } from "./Glow";
import type { PairingLanguage } from "./pairingTypes";

/**
 * L'accueil du jumelage — le premier écran de l'application. La mascotte en
 * grand, ce qu'on attend de l'utilisateur, le chemin principal (le code à
 * reporter sur le téléphone) et le recours (un serveur saisi à la main).
 * Dessous, la langue : le choix FR/EN de l'ancien écran des conditions
 * d'utilisation, supprimé, vit désormais ici.
 */

const LANGUAGES: Array<{ code: PairingLanguage; label: string }> = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export const WelcomeStep = memo(function WelcomeStep({ language, onShowCode, onManualSetup, onChangeLanguage }: {
  language: PairingLanguage;
  onShowCode?: () => void;
  onManualSetup?: () => void;
  onChangeLanguage?: (language: PairingLanguage) => void;
}) {
  const { t } = useTranslation(["pairing", "auth"]);
  return (
    <View style={styles.center}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.mascot}>
        {/* La mascotte dans la lumière de la marque : le rose, discret — le
            seul halo de l'écran avec celui du code. */}
        <Glow size={MASCOT_GLOW} color={colors.accent} opacity={MASCOT_GLOW_OPACITY} style={styles.glow} />
        <BrandMark size={232} />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.texts}>
        <Text style={styles.title}>{t("pairing:tvWelcomeTitle")}</Text>
        <Text style={styles.subtitle}>{t("pairing:tvWelcomeSubtitle")}</Text>
      </Animated.View>
      <View style={styles.actions}>
        <PillButton variant="primary" icon="phone" label={t("pairing:showPairingCode")} focusKey="pairing:showCode" onPress={onShowCode} />
        <PillButton icon="server" label={t("pairing:configureManually")} focusKey="pairing:manual" onPress={onManualSetup} />
      </View>
      <View style={styles.language}>
        <Icon name="globe" size={26} color={colors.textTertiary} />
        <Text style={styles.languageLabel}>{t("auth:language")}</Text>
        {LANGUAGES.map((entry) => (
          <Chip
            key={entry.code}
            size="md"
            label={entry.label}
            icon={entry.code === language ? "check" : undefined}
            selected={entry.code === language}
            focusKey={`pairing:lang:${entry.code}`}
            onPress={onChangeLanguage ? () => onChangeLanguage(entry.code) : undefined}
          />
        ))}
      </View>
    </View>
  );
});

const MASCOT_GLOW = 720;
const MASCOT_GLOW_OPACITY = 0.3;

const styles = StyleSheet.create({
  mascot: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 12 },
  texts: { alignItems: "center", marginTop: 34, gap: 14 },
  title: { ...text.title, fontSize: 76, lineHeight: 84, letterSpacing: -1.6, textAlign: "center" },
  subtitle: { ...fonts.regular, fontSize: 32, lineHeight: 42, color: colors.textSecondary, textAlign: "center" },
  actions: { flexDirection: "row", gap: 22, marginTop: 56 },
  language: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 64 },
  languageLabel: { ...fonts.bold, fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: colors.textTertiary, marginRight: 8 },
});
