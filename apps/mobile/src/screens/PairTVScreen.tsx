import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SubtleBackground } from "../components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import {
  useGenerateTvToken,
  useRelayConfirm,
  useTentacleConfig,
} from "@tentacle-tv/api-client";

export function PairTVScreen() {
  const { t } = useTranslation("pairing");
  const { t: te } = useTranslation("errors");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storage } = useTentacleConfig();
  const tvTokenMut = useGenerateTvToken();
  const relayConfirmMut = useRelayConfirm();

  const [chars, setChars] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "pairing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const code = chars.join("");
  const canSubmit = code.length === 4 && status === "idle";

  const handleChange = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    setChars((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === "Backspace" && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [chars]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("pairing");
    setErrorMsg("");

    try {
      const { token } = await tvTokenMut.mutateAsync();

      const serverUrl = storage.getItem("tentacle_server_url") ?? "";
      if (!serverUrl) throw new Error(te("noServerUrl"));

      const userRaw = storage.getItem("tentacle_user");
      const user = userRaw ? JSON.parse(userRaw) as { Id: string; Name: string } : null;
      if (!user?.Id || !user?.Name) throw new Error(te("userInfoNotFound"));

      await relayConfirmMut.mutateAsync({
        code,
        serverUrl,
        token,
        user: { id: user.Id, name: user.Name },
      });

      setStatus("success");
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("invalide") || msg.includes("expire")) {
        setErrorMsg(t("codeInvalid"));
      } else if (msg.includes("409") || msg.includes("utilise")) {
        setErrorMsg(t("codeInvalid"));
      } else {
        setErrorMsg(t("relayError"));
      }
    }
  }, [canSubmit, code, tvTokenMut, relayConfirmMut, storage, t]);

  const handleReset = useCallback(() => {
    setChars(["", "", "", ""]);
    setStatus("idle");
    setErrorMsg("");
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <SubtleBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
            <Feather name="chevron-left" size={26} color="#8b5cf6" />
          </Pressable>
          <Text style={[styles.title, { marginBottom: 0 }]}>{t("pairYourTV")}</Text>
        </View>
        <Text style={styles.subtitle}>{t("enterTVCode")}</Text>

        <View style={styles.card}>
          {status === "success" ? (
            <View style={styles.successContainer}>
              <Text style={styles.successIcon}>&#x2713;</Text>
              <Text style={styles.successText}>
                {t("tvPairedSuccess")}
              </Text>
            </View>
          ) : (
            <>
              {/* Code input */}
              <View style={styles.codeRow}>
                {chars.map((char, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    value={char}
                    onChangeText={(v) => handleChange(i, v)}
                    onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
                    maxLength={1}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={status !== "pairing"}
                    autoFocus={i === 0}
                    style={[
                      styles.codeInput,
                      status === "error"
                        ? styles.codeInputError
                        : char
                        ? styles.codeInputFilled
                        : styles.codeInputEmpty,
                    ]}
                  />
                ))}
              </View>

              {/* Error message */}
              {status === "error" && errorMsg ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}

              {/* Submit / retry */}
              {status === "error" ? (
                <Pressable onPress={handleReset} style={styles.button}>
                  <Text style={styles.buttonText}>{t("retry")}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  style={[styles.button, !canSubmit && styles.buttonDisabled]}
                >
                  {status === "pairing" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>{t("pairTV")}</Text>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>

        <Text style={styles.footnote}>{t("codeExpireNote")}</Text>
      </View>
    </ScrollView>
    </SubtleBackground>
  );
}

const styles = {
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#12121a",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1e1e2e",
  },
  codeRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 12,
    marginBottom: 20,
  },
  codeInput: {
    width: 56,
    height: 64,
    borderRadius: 12,
    textAlign: "center" as const,
    fontSize: 24,
    fontWeight: "700" as const,
    fontFamily: "monospace",
    color: "#fff",
  },
  codeInputEmpty: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  codeInputFilled: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderWidth: 2,
    borderColor: "#8b5cf6",
  },
  codeInputError: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center" as const,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center" as const,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  successContainer: {
    alignItems: "center" as const,
    paddingVertical: 16,
  },
  successIcon: {
    fontSize: 48,
    color: "#22c55e",
    marginBottom: 8,
  },
  successText: {
    color: "#22c55e",
    fontSize: 18,
    fontWeight: "600" as const,
  },
  footnote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center" as const,
    marginTop: 16,
  },
} as const;
