import { View, Text, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius, Typography } from "../../theme/colors";

interface ServerInputStepProps {
  serverUrl: string;
  onChangeUrl: (url: string) => void;
  testing: boolean;
  error: string | null;
  onSubmit: () => void;
  onSwitchLang: (lng: string) => void;
  currentLang: string;
}

export function ServerInputStep({
  serverUrl, onChangeUrl, testing, error, onSubmit, onSwitchLang, currentLang,
}: ServerInputStepProps) {
  const { t } = useTranslation(["auth", "pairing"]);

  return (
    <View style={styles.container}>
      {/* Language toggle */}
      <View style={styles.langToggle}>
        {(["fr", "en"] as const).map((lng) => (
          <Pressable
            key={lng}
            onPress={() => onSwitchLang(lng)}
            style={[styles.langBtn, currentLang === lng && styles.langBtnActive]}
          >
            <Text style={[styles.langText, currentLang === lng && styles.langTextActive]}>
              {lng.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <TentacleLogo size={56} />
        <Text style={styles.logo}>Tentacle</Text>
        <Text style={styles.title}>{t("auth:welcomeToTentacle")}</Text>
        <Text style={styles.subtitle}>{t("auth:enterServerUrl")}</Text>

        <TextInput
          value={serverUrl}
          onChangeText={onChangeUrl}
          placeholder={t("auth:serverUrlPlaceholder")}
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: 24, width: "100%" }}>
          <Focusable onPress={onSubmit} hasTVPreferredFocus>
            <View style={[styles.button, (testing || !serverUrl.trim()) && styles.buttonDisabled]}>
              {testing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("pairing:checkServer")}</Text>
              )}
            </View>
          </Focusable>
        </View>

        <Text style={styles.hint}>{t("pairing:tvRemoteHint")}</Text>
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.bgDeep,
  },
  card: {
    width: 540,
    padding: 48,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.buttonLarge,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center" as const,
  },
  logo: {
    color: Colors.accentPurple,
    fontSize: 36,
    fontWeight: "800" as const,
    marginTop: 12,
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  input: {
    width: "100%" as const,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: Colors.textPrimary,
    fontSize: 18,
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: Colors.accentPurple,
    borderRadius: Radius.card,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fff",
    ...Typography.buttonLarge,
  },
  hint: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 24,
  },
  langToggle: {
    position: "absolute" as const,
    top: 24,
    right: 24,
    flexDirection: "row" as const,
    borderRadius: Radius.small,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  langBtnActive: {
    backgroundColor: "rgba(139,92,246,0.3)",
  },
  langText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textMuted,
  },
  langTextActive: {
    color: Colors.accentPurpleLight,
  },
};
