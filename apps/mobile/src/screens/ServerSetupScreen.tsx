import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ServerSetupScreenProps {
  onServerValidated: (url: string) => void;
}

export function ServerSetupScreen({ onServerValidated }: ServerSetupScreenProps) {
  const { t, i18n } = useTranslation("auth");
  const [url, setUrl] = useState("");

  const switchLang = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    AsyncStorage.setItem("tentacle_language", lng);
  }, [i18n]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    let normalized = url.trim().replace(/\/+$/, "");
    if (!normalized) return;
    // Add protocol if missing (prefer https)
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    // Strip redundant default ports
    normalized = normalized.replace(/^(https:\/\/[^/:]+):443\b/, "$1");
    normalized = normalized.replace(/^(http:\/\/[^/:]+):80\b/, "$1");

    setError(null);
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(`${normalized}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error("not ok");
      }

      onServerValidated(normalized);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(t("auth:connectionTimeout"));
      } else {
        setError(t("auth:serverNotFoundRetry"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0a0a0f" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        {/* Language toggle */}
        <View style={{ position: "absolute", top: 16, right: 16, flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
          {(["fr", "en"] as const).map((lng) => (
            <Pressable key={lng} onPress={() => switchLang(lng)} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: i18n.language === lng ? "rgba(139,92,246,0.3)" : "transparent" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: i18n.language === lng ? "#c4b5fd" : "rgba(255,255,255,0.4)" }}>{lng.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            width: "100%",
            maxWidth: 400,
            padding: 32,
            backgroundColor: "#12121a",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#1e1e2e",
          }}
        >
          <Text
            style={{
              color: "#8b5cf6",
              fontSize: 28,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            Tentacle
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            {t("auth:welcomeToTentacle")}
          </Text>

          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder={t("auth:serverUrlLabel")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            style={inputStyle}
            onSubmitEditing={handleConnect}
          />

          <Text
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {t("auth:serverUrlPlaceholder")}
          </Text>

          {error && (
            <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={handleConnect}
            disabled={loading || !url.trim()}
            style={{
              marginTop: 24,
              backgroundColor: "#8b5cf6",
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: "center",
              opacity: loading || !url.trim() ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {t("auth:signIn")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "#1e1e2e",
  borderRadius: 10,
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: "#fff",
  fontSize: 16,
};
