import { View, Text, findNodeHandle } from "react-native";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Focusable } from "../focus/Focusable";
import { Colors, Radius, Typography } from "../../theme/colors";

interface WelcomeStepProps {
  onShowCode: () => void;
  onManualSetup: () => void;
  onEnterCode: () => void;
  onSwitchLang: (lng: string) => void;
  currentLang: string;
}

export function WelcomeStep({
  onShowCode,
  onManualSetup,
  onEnterCode,
  onSwitchLang,
  currentLang,
}: WelcomeStepProps) {
  const { t } = useTranslation("pairing");

  const toggleLang = useCallback(() => {
    onSwitchLang(currentLang === "fr" ? "en" : "fr");
  }, [currentLang, onSwitchLang]);

  // Le toggle de langue est en position absolue (top-right) → injoignable par la
  // navigation spatiale tvOS. On câble un chemin directionnel explicite :
  // CTA principal ⟵UP⟶ langue ⟵DOWN⟶ CTA principal.
  const langRef = useRef<View>(null);
  const primaryRef = useRef<View>(null);
  const [langTag, setLangTag] = useState<number | undefined>(undefined);
  const [primaryTag, setPrimaryTag] = useState<number | undefined>(undefined);
  useEffect(() => {
    setLangTag(findNodeHandle(langRef.current) ?? undefined);
    setPrimaryTag(findNodeHandle(primaryRef.current) ?? undefined);
  }, []);

  return (
    <View style={styles.container}>
      {/* Language toggle */}
      <View style={styles.langRow}>
        <Focusable ref={langRef} variant="button" onPress={toggleLang} nextFocusDown={primaryTag}>
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
        <Focusable ref={primaryRef} variant="button" onPress={onShowCode} hasTVPreferredFocus nextFocusUp={langTag} focusRadius={Radius.buttonLarge + 3} style={{ marginBottom: 16 }}>
          <View style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {t("pairing:showPairingCode")}
            </Text>
          </View>
        </Focusable>

        {/* Manual fallback link */}
        <Focusable variant="button" onPress={onManualSetup} focusRadius={Radius.buttonLarge + 3} style={{ marginBottom: 12 }}>
          <View style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {t("pairing:configureManually")}
            </Text>
          </View>
        </Focusable>

        {/* Provisioning code entry (store reviewers) */}
        <Focusable variant="button" onPress={onEnterCode} focusRadius={Radius.buttonLarge + 3}>
          <View style={styles.tertiaryButton}>
            <Text style={styles.tertiaryButtonText}>
              {t("pairing:haveCode")}
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
  // CTA core (fiche média) : primaire blanc + ghost translucide
  primaryButton: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    backgroundColor: Colors.ctaPrimaryBg,
    borderRadius: Radius.buttonLarge,
  },
  primaryButtonText: {
    color: Colors.ctaPrimaryFg,
    ...Typography.buttonLarge,
    textAlign: "center" as const,
  },
  secondaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    backgroundColor: Colors.ctaGhostBg,
    borderRadius: Radius.buttonLarge,
    borderWidth: 1,
    borderColor: Colors.ctaGhostBorder,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    ...Typography.buttonLarge,
    textAlign: "center" as const,
  },
  tertiaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  tertiaryButtonText: {
    color: Colors.textMuted,
    ...Typography.buttonMedium,
    textAlign: "center" as const,
  },
} as const;
