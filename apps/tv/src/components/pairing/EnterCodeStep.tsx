import { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useRelayStatus } from "@tentacle-tv/api-client";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius, Typography } from "../../theme/colors";

interface EnterCodeStepProps {
  onConfirmed: (data: RelayStatusResponse) => void;
  onBack: () => void;
}

/**
 * Saisie d'un code de jumelage de provisionnement (code long admin, géré depuis
 * l'admin web). La TV interroge le relay : si l'entrée pré-confirmée existe, le
 * jumelage est immédiat. Pensé pour les testeurs des stores TV.
 */
export function EnterCodeStep({ onConfirmed, onBack }: EnterCodeStepProps) {
  const { t } = useTranslation(["pairing", "common"]);
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll le relay une fois un code soumis (réutilise le hook du flux relais).
  const { data, isFetching } = useRelayStatus(submitted);

  useEffect(() => {
    if (!submitted || !data) return;
    if (data.status === "confirmed" && data.serverUrl && data.token && data.user) {
      onConfirmed(data);
    } else if (data.status === "expired") {
      setError(t("pairing:codeInvalid"));
      setSubmitted(null);
    }
  }, [data, submitted, onConfirmed, t]);

  const submit = () => {
    const code = value.trim().toUpperCase();
    if (!code) return;
    setError(null);
    setSubmitted(code);
  };

  const checking = !!submitted && (isFetching || data?.status === "pending");

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TentacleLogo size={56} />
        <Text style={styles.title}>{t("pairing:enterProvisioningTitle")}</Text>
        <Text style={styles.subtitle}>{t("pairing:enterProvisioningSubtitle")}</Text>

        <View style={{ width: "100%" }}>
          <Focusable variant="button" onPress={() => inputRef.current?.focus()} hasTVPreferredFocus>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(text) => { setValue(text); setError(null); }}
                onSubmitEditing={submit}
                placeholder="XXXXXXXXXXXX"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                style={styles.input}
              />
            </View>
          </Focusable>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ marginTop: 24, width: "100%", gap: 12 }}>
          <Focusable variant="button" onPress={submit}>
            <View style={[styles.buttonPrimary, (checking || !value.trim()) && styles.buttonDisabled]}>
              {checking ? (
                <ActivityIndicator color={Colors.ctaPrimaryFg} />
              ) : (
                <Text style={styles.buttonPrimaryText}>{t("pairing:validateCode")}</Text>
              )}
            </View>
          </Focusable>
          <Focusable variant="button" onPress={onBack} accessibilityLabel={t("common:back")}>
            <View style={styles.buttonGhost}>
              <Text style={styles.buttonGhostText}>{t("common:back")}</Text>
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
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" as const,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  inputWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    overflow: "hidden" as const,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: Colors.textPrimary,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: "center" as const,
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
  buttonPrimary: {
    backgroundColor: Colors.ctaPrimaryBg,
    borderRadius: Radius.buttonLarge,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonPrimaryText: {
    color: Colors.ctaPrimaryFg,
    ...Typography.buttonLarge,
  },
  buttonGhost: {
    backgroundColor: Colors.ctaGhostBg,
    borderWidth: 1,
    borderColor: Colors.ctaGhostBorder,
    borderRadius: Radius.buttonLarge,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonGhostText: {
    color: Colors.textPrimary,
    ...Typography.buttonLarge,
  },
  buttonDisabled: { opacity: 0.4 },
  hint: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 24,
  },
};
