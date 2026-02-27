import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import {
  useTentacleConfig,
  useJellyfinClient,
  useClaimPairingCode,
  setPairingBackendUrl,
  setSeerrBackendUrl,
  setPreferencesBackendUrl,
  setRequestsBackendUrl,
  setTicketsBackendUrl,
  setNotificationsBackendUrl,
  setConfigBackendUrl,
} from "@tentacle/api-client";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

const VALID_CHARS = /^[A-Z2-9]$/;

export function PairCodeScreen({ navigation }: Props) {
  const { t } = useTranslation("pairing");
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();
  const claimMut = useClaimPairingCode();
  const [chars, setChars] = useState(["", "", "", ""]);
  const [paired, setPaired] = useState(false);
  const [pairUser, setPairUser] = useState("");
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Initialize all backend URLs
  useEffect(() => {
    const serverUrl = storage.getItem("tentacle_server_url");
    if (serverUrl) {
      setPairingBackendUrl(serverUrl);
      setSeerrBackendUrl(serverUrl);
      setPreferencesBackendUrl(serverUrl);
      setRequestsBackendUrl(serverUrl);
      setTicketsBackendUrl(serverUrl);
      setNotificationsBackendUrl(serverUrl);
      setConfigBackendUrl(serverUrl);
    }
  }, [storage]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  // Reset on error
  useEffect(() => {
    if (claimMut.isError) {
      setChars(["", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [claimMut.isError]);

  const updateChar = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (!upper) return;

    const next = [...chars];
    next[index] = upper[0];
    setChars(next);

    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace") {
      if (chars[index]) {
        const next = [...chars];
        next[index] = "";
        setChars(next);
      } else if (index > 0) {
        const next = [...chars];
        next[index - 1] = "";
        setChars(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const code = chars.join("");
  const canSubmit = code.length === 4 && !claimMut.isPending && !paired;

  const handleSubmit = () => {
    if (!canSubmit) return;
    claimMut.mutate(
      { code, deviceName: "Android TV" },
      {
        onSuccess: (data) => {
          setPaired(true);
          setPairUser(data.username || "");
          jellyfinClient.setAccessToken(data.token);
          storage.setItem("tentacle_token", data.token);
          if (data.userId && data.username) {
            storage.setItem(
              "tentacle_user",
              JSON.stringify({ Id: data.userId, Name: data.username }),
            );
          }
          setTimeout(() => navigation.replace("Home"), 2000);
        },
      },
    );
  };

  // Auto-submit when 4 chars are entered
  useEffect(() => {
    if (code.length === 4 && !claimMut.isPending && !paired) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Success state ──
  if (paired) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>{t("pairing:pairingSuccess")}</Text>
          <Text style={styles.successSub}>
            {t("pairing:welcomeUser", { username: pairUser })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>Tentacle</Text>
        <Text style={styles.title}>{t("pairing:tvPairTitle")}</Text>
        <Text style={styles.subtitle}>
          {t("pairing:tvPairInstructions")}
        </Text>

        {/* Code input boxes */}
        <View style={styles.codeRow}>
          {chars.map((char, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              value={char}
              onChangeText={(text) => updateChar(i, text)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              maxLength={1}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[
                styles.codeBox,
                char ? styles.codeBoxFilled : null,
                claimMut.isError ? styles.codeBoxError : null,
              ]}
              placeholderTextColor="rgba(255,255,255,0.15)"
            />
          ))}
        </View>

        {/* Loading */}
        {claimMut.isPending && (
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.statusText}>{t("pairing:pairing")}</Text>
          </View>
        )}

        {/* Error message */}
        {claimMut.isError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t("pairing:codeInvalid")}</Text>
          </View>
        )}

        {/* Submit button */}
        <View style={{ marginTop: 24 }}>
          <Focusable onPress={handleSubmit}>
            <View style={[styles.button, !canSubmit && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{t("pairing:pair")}</Text>
            </View>
          </Focusable>
        </View>

        {/* Back button */}
        <View style={{ marginTop: 12 }}>
          <Focusable onPress={() => navigation.replace("ServerSetup")}>
            <View style={styles.backButton}>
              <Text style={styles.backText}>{t("common:back")}</Text>
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
    backgroundColor: "#0a0a0f",
  },
  card: {
    width: 540,
    padding: 48,
    backgroundColor: "#12121a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    alignItems: "center" as const,
  },
  logo: {
    color: "#8b5cf6",
    fontSize: 36,
    fontWeight: "800" as const,
    marginBottom: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    textAlign: "center" as const,
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "800" as const,
    fontFamily: "monospace",
  },
  codeBoxFilled: {
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139,92,246,0.12)",
  },
  codeBoxError: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  statusText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    marginTop: 8,
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
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center" as const,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  backButton: {
    paddingVertical: 12,
    alignItems: "center" as const,
  },
  backText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 15,
  },
  successIcon: {
    color: "#22c55e",
    fontSize: 64,
    fontWeight: "800" as const,
    marginBottom: 16,
  },
  successTitle: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  successSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 18,
  },
};
