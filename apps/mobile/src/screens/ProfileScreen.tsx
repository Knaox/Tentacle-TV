import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "../theme";
import { GlassCard, Badge, Button, Divider, FadeIn, SubtleBackground } from "../components/ui";
import { AdminSection, PairedDevicesSection, MediaPreferencesSection } from "../components/profile";
import { clearCredentials } from "../auth/credentialManager";

// Read version directly from app.json (expo-constants bakes the value into the native build)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appVersion: string = require("../../app.json").expo?.version ?? "1.0.0";

const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const router = useRouter();
  const { logout } = useAuth();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const user = (() => {
    try {
      const raw = storage.getItem("tentacle_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const isAdmin = user?.Policy?.IsAdministrator === true;
  const userName = user?.Name ?? t("defaultUsername");
  const initial = userName.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        clearCredentials(storage);
        router.replace("/(auth)/login");
      },
    });
  };

  const handleClearCache = useCallback(() => {
    Alert.alert(
      t("clearCacheTitle"),
      t("clearCacheMessage"),
      [
        { text: t("clearCacheCancel"), style: "cancel" },
        {
          text: t("clearCacheConfirm"),
          style: "destructive",
          onPress: () => {
            storage.clear?.();
            queryClient.clear();
            router.replace("/(auth)/server-setup");
          },
        },
      ]
    );
  }, [t, queryClient, router]);

  const handleDeleteAccount = useCallback(() => {
    if (isAdmin) {
      Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError"));
      return;
    }

    Alert.alert(
      t("deleteAccountTitle"),
      t("deleteAccountMessage"),
      [
        { text: t("deleteAccountCancel"), style: "cancel" },
        {
          text: t("deleteAccountConfirm"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const serverUrl = storage.getItem("tentacle_server_url");
              const token = storage.getItem("tentacle_token");
              if (!serverUrl || !token) return;

              const res = await fetch(`${serverUrl}/api/auth/account`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (res.status === 403) {
                Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError"));
                return;
              }

              if (!res.ok) {
                Alert.alert(t("deleteAccountTitle"), t("deleteAccountError"));
                return;
              }

              storage.clear?.();
              queryClient.clear();
              router.replace("/(auth)/server-setup");
            } catch {
              Alert.alert(t("deleteAccountTitle"), t("deleteAccountError"));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [t, isAdmin, storage, queryClient, router]);

  return (
    <SubtleBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <View style={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg }}>
        <Text
          style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.xl }}
          accessibilityRole="header"
        >
          {t("title")}
        </Text>

        {/* User info */}
        <FadeIn delay={0}>
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              accessibilityLabel={`${userName}${isAdmin ? `, ${t("adminBadge")}` : ""}`}
            >
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }} accessibilityElementsHidden>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.subtitle, color: colors.textPrimary }}>{userName}</Text>
                {isAdmin && <Badge label={t("adminBadge")} variant="accent" />}
              </View>
            </View>
          </GlassCard>
        </FadeIn>

        {/* Quick actions */}
        <FadeIn delay={80}>
          <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xxl }}>
            <QuickActionCard
              iconName="monitor"
              label={t("pairTV")}
              onPress={() => router.push("/pair-tv")}
            />
            <QuickActionCard
              iconName="help-circle"
              label={t("support")}
              onPress={() => router.push("/support")}
            />
            <QuickActionCard
              iconName="info"
              label={t("about")}
              onPress={() => router.push("/about")}
            />
          </View>
        </FadeIn>

        {/* Preferences */}
        <FadeIn delay={160}>
          <Text
            style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}
            accessibilityRole="header"
          >
            {t("preferences")}
          </Text>

          <GlassCard style={{ marginBottom: spacing.xxl }}>
            <LanguageToggle />
            <Divider />
            <MediaPreferencesSection />
          </GlassCard>
        </FadeIn>

        {/* Paired devices */}
        <FadeIn delay={240}>
          <PairedDevicesSection />
        </FadeIn>

        {/* Admin section */}
        {isAdmin && <FadeIn delay={320}><AdminSection /></FadeIn>}

        {/* Privacy policy */}
        <FadeIn delay={400}>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            accessibilityRole="link"
            accessibilityLabel={t("privacyPolicy")}
            style={{
              marginTop: spacing.xxl, alignItems: "center",
              flexDirection: "row", justifyContent: "center", gap: spacing.sm,
              paddingVertical: 12,
            }}
          >
            <Feather name="external-link" size={14} color={colors.textMuted} />
            <Text style={{ ...typography.caption, color: colors.textMuted, textDecorationLine: "underline" }}>
              {t("privacyPolicy")}
            </Text>
          </Pressable>
        </FadeIn>

        {/* Danger zone */}
        <FadeIn delay={480}>
          <Text
            style={{ ...typography.subtitle, color: colors.danger, marginTop: spacing.xl, marginBottom: spacing.md }}
            accessibilityRole="header"
          >
            {t("dangerZone")}
          </Text>
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={t("deleteAccount")}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
              width: "100%", paddingVertical: 14, borderRadius: spacing.buttonRadius,
              backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder,
              marginBottom: spacing.md, opacity: deleting ? 0.6 : 1,
            }}
          >
            <Feather name="user-x" size={16} color={colors.danger} />
            <Text style={{ ...typography.bodyBold, color: colors.danger }}>{t("deleteAccount")}</Text>
          </Pressable>
          <Pressable
            onPress={handleClearCache}
            accessibilityRole="button"
            accessibilityLabel={t("clearCache")}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
              width: "100%", paddingVertical: 14, borderRadius: spacing.buttonRadius,
              backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder,
              marginBottom: spacing.md,
            }}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={{ ...typography.bodyBold, color: colors.danger }}>{t("clearCache")}</Text>
          </Pressable>
          <Button
            title={t("logout")}
            onPress={handleLogout}
            variant="danger"
            fullWidth
          />
        </FadeIn>

        {/* Footer version */}
        <View style={{ marginTop: spacing.xl, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.textDim }}>
            Tentacle TV v{appVersion}
          </Text>
        </View>
      </View>
    </ScrollView>
    </SubtleBackground>
  );
}

function LanguageToggle() {
  const { t, i18n } = useTranslation("profile");
  const { storage } = useTentacleConfig();

  const switchLanguage = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
  }, [i18n, storage]);

  const currentLang = i18n.language?.startsWith("fr") ? "fr" : "en";

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm }}>
        {t("language")}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }} accessibilityRole="radiogroup">
        <Pressable
          onPress={() => switchLanguage("fr")}
          accessibilityRole="radio"
          accessibilityState={{ selected: currentLang === "fr" }}
          accessibilityLabel={t("french")}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: spacing.buttonRadius, alignItems: "center",
            backgroundColor: currentLang === "fr" ? colors.accent : "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: currentLang === "fr" ? colors.accent : colors.border,
          }}
        >
          <Text style={{
            ...typography.bodyBold, fontSize: 14,
            color: currentLang === "fr" ? "#fff" : colors.textSecondary,
          }}>
            {t("french")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchLanguage("en")}
          accessibilityRole="radio"
          accessibilityState={{ selected: currentLang === "en" }}
          accessibilityLabel={t("english")}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: spacing.buttonRadius, alignItems: "center",
            backgroundColor: currentLang === "en" ? colors.accent : "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: currentLang === "en" ? colors.accent : colors.border,
          }}
        >
          <Text style={{
            ...typography.bodyBold, fontSize: 14,
            color: currentLang === "en" ? "#fff" : colors.textSecondary,
          }}>
            {t("english")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function QuickActionCard({ iconName, label, onPress }: { iconName: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={label}>
      <GlassCard>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.accentMuted, alignItems: "center", justifyContent: "center",
          }}>
            <Feather name={iconName as keyof typeof Feather.glyphMap} size={18} color={colors.accentLight} />
          </View>
          <Text style={{ ...typography.bodyBold, fontSize: 13, color: colors.textPrimary }}>{label}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}
