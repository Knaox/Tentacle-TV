import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Focusable } from "../focus/Focusable";
import { Colors, Radius, Typography } from "../../theme/colors";

interface WelcomeStepProps {
  onShowCode: () => void;
  onManualSetup: () => void;
  onSwitchLang: (lng: string) => void;
  currentLang: string;
}

export function WelcomeStep({
  onShowCode,
  onManualSetup,
  onSwitchLang,
  currentLang,
}: WelcomeStepProps) {
  const { t } = useTranslation("pairing");

  const toggleLang = useCallback(() => {
    onSwitchLang(currentLang === "fr" ? "en" : "fr");
  }, [currentLang, onSwitchLang]);

  return (
    <View style={styles.container}>
      {/* Language toggle */}
      <View style={styles.langRow}>
        <Focusable onPress={toggleLang}>
          <View style={styles.langButton}>
            <Text style={styles.langText}>
              {currentLang === "fr" ? "EN" : "FR"}
            </Text>
          </View>
        </Focusable>
      </View>

      <View style={styles.content}>
        <TentacleLogo size={96} />
        <Text style={styles.title}>{t("pairing:tvWelcomeTitle")}</Text>
        <Text style={styles.subtitle}>{t("pairing:tvWelcomeSubtitle")}</Text>

        {/* Primary CTA */}
        <Focusable onPress={onShowCode} hasTVPreferredFocus>
          <View style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {t("pairing:showPairingCode")}
            </Text>
          </View>
        </Focusable>

        {/* Manual fallback link */}
        <Focusable onPress={onManualSetup}>
          <View style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {t("pairing:configureManually")}
            </Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  langRow: {
    position: "absolute" as const,
    top: 32,
    right: 32,
    zIndex: 10,
  },
  langButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  langText: {
    color: Colors.textSecondary,
    ...Typography.buttonMedium,
  },
  content: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 48,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: "800" as const,
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center" as const,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: "400" as const,
    marginBottom: 48,
    textAlign: "center" as const,
  },
  primaryButton: {
    paddingHorizontal: 48,
    paddingVertical: 18,
    backgroundColor: Colors.accentPurple,
    borderRadius: Radius.buttonLarge,
    marginBottom: 20,
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center" as const,
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: "400" as const,
    textAlign: "center" as const,
  },
} as const;
