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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { verifyServer } from "@tentacle-tv/shared";
import {
  SubtleBackground,
  GlassCard,
  FadeIn,
  makeAuthStyles,
} from "../components/auth/authStyles";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles } from "@/theme";

interface ServerSetupScreenProps {
  onServerValidated: (url: string) => void;
}

export function ServerSetupScreen({ onServerValidated }: ServerSetupScreenProps) {
  const { t, i18n } = useTranslation("auth");
  const { colors } = useTheme();
  const auth = useThemedStyles(makeAuthStyles);
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchLang = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    AsyncStorage.setItem("tentacle_language", lng);
  }, [i18n]);

  const handleConnect = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await verifyServer(url);
      if (result.success) {
        onServerValidated(result.url);
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setError(t(key, result.errorParams));
      }
    } catch {
      setError(t("serverNotFoundRetry"));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!url.trim() && !loading;

  return (
    <SubtleBackground ambient>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
          <View
            style={{
              position: "absolute",
              top: Math.max(insets.top, 24) + 12,
              right: 16,
              flexDirection: "row",
              borderRadius: RADIUS.md,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border.subtle,
            }}
            accessibilityRole="radiogroup"
            accessibilityLabel="Language"
          >
            {(["fr", "en"] as const).map((lng) => (
              <Pressable
                key={lng}
                onPress={() => switchLang(lng)}
                accessibilityRole="radio"
                accessibilityState={{ selected: i18n.language === lng }}
                accessibilityLabel={lng === "fr" ? "Francais" : "English"}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    minHeight: 36,
                    backgroundColor: i18n.language === lng ? colors.brand.soft : "transparent",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: FONT_FAMILY.bold,
                  letterSpacing: 0.5,
                  color: i18n.language === lng ? colors.brand.light : colors.text.quaternary,
                }}>
                  {lng.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <FadeIn delay={0} translateY={12} style={{ alignItems: "center", marginBottom: 24 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.brand.soft,
              borderWidth: 1,
              borderColor: colors.brand.glow,
              justifyContent: "center",
              alignItems: "center",
              shadowColor: colors.brand.violet,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 8,
            }}>
              <Feather name="server" size={40} color={colors.brand.light} />
            </View>
          </FadeIn>

          <FadeIn delay={80} translateY={14} style={{ width: "100%", maxWidth: 400 }}>
            <GlassCard style={{ padding: 28 }}>
              <Text style={auth.title} accessibilityRole="header">
                {t("welcomeToTentacle")}
              </Text>
              <Text style={auth.subtitle}>
                {t("enterServerUrl", { defaultValue: "Entrez l'URL de votre serveur Tentacle/Jellyfin" })}
              </Text>

              <View style={{ position: "relative" }}>
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder={t("serverUrlPlaceholder")}
                  placeholderTextColor={colors.text.quaternary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                  accessibilityLabel={t("serverUrlLabel")}
                  style={[auth.input, loading && { paddingRight: 44 }]}
                  onSubmitEditing={handleConnect}
                />
                {loading && (
                  <ActivityIndicator
                    color={colors.brand.violet}
                    size="small"
                    style={{ position: "absolute", right: 14, top: 12 }}
                  />
                )}
              </View>

              <Text
                style={{
                  color: colors.text.quaternary,
                  fontSize: 12,
                  fontFamily: FONT_FAMILY.regular,
                  marginTop: 8,
                  lineHeight: 18,
                }}
              >
                {t("serverUrlHint", { defaultValue: t("serverUrlPlaceholder") })}
              </Text>

              {error && (
                <Text style={{
                  color: colors.status.error,
                  fontSize: 13,
                  fontFamily: FONT_FAMILY.medium,
                  marginTop: 12,
                }}>
                  {error}
                </Text>
              )}

              <Pressable
                onPress={handleConnect}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={t("signIn")}
                style={({ pressed }) => [
                  auth.primaryCta,
                  { marginTop: 22, opacity: !canSubmit ? 0.55 : (pressed ? 0.88 : 1) },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.cta.primaryFg} />
                ) : (
                  <Text style={{
                    color: colors.cta.primaryFg,
                    fontSize: 15,
                    fontFamily: FONT_FAMILY.bold,
                    letterSpacing: 0.2,
                  }}>
                    {t("signIn")}
                  </Text>
                )}
              </Pressable>
            </GlassCard>
          </FadeIn>
        </View>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}
