import { useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { colors, spacing, typography } from "../theme";
import { GlassCard, Badge, Button, Divider, FadeIn, SubtleBackground } from "../components/ui";
import { AdminSection, PairedDevicesSection, MediaPreferencesSection } from "../components/profile";

const appVersion = Constants.expoConfig?.version ?? "1.0.0";

export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const router = useRouter();
  const { logout } = useAuth();
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();

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
      onSuccess: () => router.replace("/(auth)/login"),
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

  return (
    <SubtleBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <View style={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg }}>
        <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.xl }}>
          {t("title")}
        </Text>

        {/* User info */}
        <FadeIn delay={0}>
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{initial}</Text>
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
          <Text style={{ ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md }}>
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

        {/* Footer */}
        <View style={{ marginTop: spacing.xxl, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: spacing.xl }}>
            Tentacle TV v{appVersion}
          </Text>
          <Pressable
            onPress={handleClearCache}
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
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={() => switchLanguage("fr")}
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
    <Pressable onPress={onPress} style={{ flex: 1 }}>
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
