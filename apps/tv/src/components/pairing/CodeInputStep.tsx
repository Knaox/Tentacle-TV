import { useRef, useEffect } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Focusable } from "../focus/Focusable";
import { TentacleLogo } from "../icons/TentacleLogo";
import { Colors, Radius, Typography } from "../../theme/colors";

interface CodeInputStepProps {
  chars: string[];
  onUpdateChar: (index: number, value: string) => void;
  onKeyPress: (index: number, key: string) => void;
  isPending: boolean;
  isError: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onChangeServer: () => void;
}

export function CodeInputStep({
  chars, onUpdateChar, onKeyPress,
  isPending, isError, canSubmit,
  onSubmit, onChangeServer,
}: CodeInputStepProps) {
  const { t } = useTranslation("pairing");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  useEffect(() => {
    if (isError) {
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [isError]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TentacleLogo size={48} />
        <Text style={styles.logo}>Tentacle</Text>
        <Text style={styles.title}>{t("pairing:tvPairTitle")}</Text>
        <Text style={styles.subtitle}>{t("pairing:tvPairInstructions")}</Text>

        {/* Code input boxes */}
        <View style={styles.codeRow}>
          {chars.map((char, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              value={char}
              onChangeText={(text) => {
                const upper = text.toUpperCase().replace(/[^A-Z2-9]/g, "");
                if (!upper) return;
                onUpdateChar(i, upper[0]);
                if (i < 3) inputRefs.current[i + 1]?.focus();
              }}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Backspace") {
                  onKeyPress(i, "Backspace");
                  if (!chars[i] && i > 0) inputRefs.current[i - 1]?.focus();
                }
              }}
              maxLength={1}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[
                styles.codeBox,
                char ? styles.codeBoxFilled : null,
                isError ? styles.codeBoxError : null,
              ]}
              placeholderTextColor="rgba(255,255,255,0.15)"
            />
          ))}
        </View>

        {isPending && (
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={Colors.accentPurple} />
            <Text style={styles.statusText}>{t("pairing:pairing")}</Text>
          </View>
        )}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t("pairing:codeInvalid")}</Text>
          </View>
        )}

        <View style={{ marginTop: 24, width: "100%" }}>
          <Focusable onPress={onSubmit}>
            <View style={[styles.button, !canSubmit && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{t("pairing:pair")}</Text>
            </View>
          </Focusable>
        </View>

        <View style={{ marginTop: 12 }}>
          <Focusable onPress={onChangeServer}>
            <View style={styles.backButton}>
              <Text style={styles.backText}>{t("pairing:changeServer")}</Text>
            </View>
          </Focusable>
        </View>
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
  codeRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 12,
  },
  codeBox: {
    width: 72,
    height: 88,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: Radius.buttonLarge,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    textAlign: "center" as const,
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: "800" as const,
    fontFamily: "monospace",
  },
  codeBoxFilled: {
    borderColor: Colors.accentPurple,
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  codeBoxError: {
    borderColor: Colors.error,
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
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
  backButton: {
    paddingVertical: 12,
    alignItems: "center" as const,
  },
  backText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
};
