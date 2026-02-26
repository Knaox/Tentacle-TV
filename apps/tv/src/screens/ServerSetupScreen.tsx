import { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useTentacleConfig } from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import { verifyServer } from "@tentacle/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "ServerSetup">;

export function ServerSetupScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation("auth");
  const { storage } = useTentacleConfig();
  const [serverUrl, setServerUrl] = useState("");

  const switchLang = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
  }, [i18n, storage]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTest = async () => {
    if (!serverUrl.trim()) return;

    setTesting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await verifyServer(serverUrl);
      if (result.success) {
        storage.setItem("tentacle_server_url", result.url);
        setSuccess(true);
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setError(t(`auth:${key}`, result.errorParams));
      }
    } catch {
      setError(t("auth:serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Language toggle */}
      <View style={{ position: "absolute", top: 24, right: 24, flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
        {(["fr", "en"] as const).map((lng) => (
          <Pressable key={lng} onPress={() => switchLang(lng)} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: i18n.language === lng ? "rgba(139,92,246,0.3)" : "transparent" }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: i18n.language === lng ? "#c4b5fd" : "rgba(255,255,255,0.4)" }}>{lng.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.logo}>Tentacle</Text>
        <Text style={styles.title}>{t("auth:welcomeToTentacle")}</Text>
        <Text style={styles.subtitle}>
          {t("auth:enterServerUrl")}
        </Text>

        {/* Server URL Input */}
        <TextInput
          value={serverUrl}
          onChangeText={(text) => {
            setServerUrl(text);
            setError(null);
            setSuccess(false);
          }}
          placeholder={t("auth:serverUrlPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success message */}
        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{t("pairing:serverConnected")}</Text>
          </View>
        )}

        {!success ? (
          <>
            {/* Connect button */}
            <View style={{ marginTop: 24 }}>
              <Focusable onPress={handleTest} hasTVPreferredFocus>
                <View
                  style={[
                    styles.button,
                    (testing || !serverUrl.trim()) && styles.buttonDisabled,
                  ]}
                >
                  {testing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t("pairing:checkServer")}</Text>
                  )}
                </View>
              </Focusable>
            </View>
            <Text style={styles.helpText}>
              {t("pairing:tvRemoteHint")}
            </Text>
          </>
        ) : (
          <>
            {/* After successful health check: choose auth method */}
            <Text style={styles.choiceTitle}>{t("pairing:howToConnect")}</Text>
            <View style={{ marginTop: 16 }}>
              <Focusable onPress={() => navigation.replace("PairCode")} hasTVPreferredFocus>
                <View style={styles.button}>
                  <Text style={styles.buttonText}>{t("pairing:pairWithCode")}</Text>
                  <Text style={styles.choiceHint}>
                    {t("pairing:pairWithCodeDesc")}
                  </Text>
                </View>
              </Focusable>
            </View>
            <View style={{ marginTop: 12 }}>
              <Focusable onPress={() => navigation.replace("Login")}>
                <View style={styles.buttonOutline}>
                  <Text style={styles.buttonText}>{t("pairing:manualLogin")}</Text>
                  <Text style={styles.choiceHint}>{t("pairing:manualLoginDesc")}</Text>
                </View>
              </Focusable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#0a0a0f",
  },
  card: {
    width: 500,
    padding: 48,
    backgroundColor: "#12121a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1e2e",
  },
  logo: {
    color: "#8b5cf6",
    fontSize: 42,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    marginBottom: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    textAlign: "center" as const,
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "#1e1e2e",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 18,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center" as const,
  },
  successContainer: {
    marginTop: 16,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  successText: {
    color: "#22c55e",
    fontSize: 14,
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center" as const,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonSuccess: {
    backgroundColor: "#22c55e",
  },
  buttonOutline: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    backgroundColor: "transparent",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  choiceTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center" as const,
    marginTop: 24,
    fontWeight: "600" as const,
  },
  choiceHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    marginTop: 4,
  },
  helpText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 24,
  },
};
