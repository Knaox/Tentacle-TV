import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";
import {
  useTentacleConfig,
  useJellyfinClient,
  useGeneratePairingCode,
  usePairingStatus,
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

export function PairCodeScreen({ navigation }: Props) {
  const { t } = useTranslation("pairing");
  const { storage } = useTentacleConfig();
  const jellyfinClient = useJellyfinClient();
  const generateMut = useGeneratePairingCode();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(300);
  const [paired, setPaired] = useState(false);
  const [pairUser, setPairUser] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Generate code on mount
  const generate = useCallback(() => {
    setCode(null);
    setRemaining(300);
    setPaired(false);
    generateMut.mutate(
      { deviceName: "Android TV" },
      {
        onSuccess: (data) => {
          setCode(data.code);
          setExpiresAt(new Date(data.expiresAt));
        },
      },
    );
  }, [generateMut]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Pulse animation while waiting
  useEffect(() => {
    if (!code || expired || paired) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [code, remaining <= 0, paired, pulseAnim]);

  // Poll for status
  const expired = remaining <= 0;
  const { data: statusData } = usePairingStatus(code && !expired && !paired ? code : null);

  // Handle confirmed status
  useEffect(() => {
    if (statusData?.status === "confirmed" && statusData.token) {
      setPaired(true);
      setPairUser(statusData.username || "");
      jellyfinClient.setAccessToken(statusData.token);
      storage.setItem("tentacle_token", statusData.token);
      if (statusData.userId && statusData.username) {
        storage.setItem(
          "tentacle_user",
          JSON.stringify({ Id: statusData.userId, Name: statusData.username }),
        );
      }
      setTimeout(() => navigation.replace("Home"), 2000);
    }
  }, [statusData, jellyfinClient, storage, navigation]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = expiresAt ? Math.max(0, remaining / 300) : 1;

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

        {!code ? (
          <ActivityIndicator size="large" color="#8b5cf6" style={{ marginVertical: 32 }} />
        ) : (
          <>
            <Text style={styles.subtitle}>
              {t("pairing:tvPairInstructions")}
            </Text>

            {/* Code display */}
            <Animated.View style={[styles.codeRow, { opacity: expired ? 0.3 : pulseAnim }]}>
              {code.split("").map((char, i) => (
                <View key={i} style={[styles.codeBox, expired && styles.codeBoxExpired]}>
                  <Text style={[styles.codeChar, expired && styles.codeCharExpired]}>{char}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Timer / progress bar */}
            <Text style={[styles.timer, expired && styles.timerExpired]}>
              {expired ? t("pairing:codeExpired") : t("pairing:expiresIn", { time: `${minutes}:${seconds.toString().padStart(2, "0")}` })}
            </Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>
          </>
        )}

        {expired && (
          <View style={{ marginTop: 20 }}>
            <Focusable onPress={generate} hasTVPreferredFocus>
              <View style={styles.button}>
                <Text style={styles.buttonText}>{t("pairing:generateNewCode")}</Text>
              </View>
            </Focusable>
          </View>
        )}

        <View style={{ marginTop: expired ? 12 : 28 }}>
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
    marginBottom: 24,
  },
  codeRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 14,
    marginBottom: 20,
  },
  codeBox: {
    width: 76,
    height: 92,
    backgroundColor: "rgba(139,92,246,0.12)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#8b5cf6",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  codeBoxExpired: { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.03)" },
  codeChar: { color: "#ffffff", fontSize: 44, fontWeight: "800" as const, fontFamily: "monospace" },
  codeCharExpired: { color: "rgba(255,255,255,0.25)" },
  timer: { color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" as const, marginBottom: 8 },
  timerExpired: { color: "#ef4444" },
  progressBg: { width: "100%" as const, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" as const },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: "#8b5cf6" },
  button: { backgroundColor: "#8b5cf6", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, alignItems: "center" as const },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" as const },
  backButton: { paddingVertical: 12, alignItems: "center" as const },
  backText: { color: "rgba(255,255,255,0.4)", fontSize: 15 },
  successIcon: { color: "#22c55e", fontSize: 64, fontWeight: "800" as const, marginBottom: 16 },
  successTitle: { color: "#22c55e", fontSize: 28, fontWeight: "700" as const, marginBottom: 8 },
  successSub: { color: "rgba(255,255,255,0.6)", fontSize: 18 },
};
