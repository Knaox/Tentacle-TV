import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { colors, spacing, typography, BRAND, BORDER, FONT_FAMILY, RADIUS, SHADOW_RN, STATUS } from "../theme";
import { Badge, FadeIn, GlassCard, SubtleBackground } from "../components/ui";
import { AdminSection, PairedDevicesSection, MediaPreferencesSection } from "../components/profile";
import { clearCredentials } from "../auth/credentialManager";
import { useServerUrl } from "../providers/ServerUrlContext";

const appVersion: string = require("../../app.json").expo?.version ?? "1.0.0";
const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

/**
 * Profile — avatar XL gradient violet, sections Inter ExtraBold, Danger Zone
 * consolidée en liste compacte (logout/delete/change/clear) au lieu de 4
 * boutons séparés. Ambient orbe violet en haut.
 */
export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const router = useRouter();
  const { logout, changeServer } = useAuth();
  const { storage } = useTentacleConfig();
  const { setServerUrl } = useServerUrl();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const user = (() => {
    try { const raw = storage.getItem("tentacle_user"); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  })();

  const isAdmin = user?.Policy?.IsAdministrator === true;
  const userName = user?.Name ?? t("defaultUsername");
  const initial = userName.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => { clearCredentials(storage); router.replace("/(auth)/login"); } });
  };

  const handleChangeServer = useCallback(() => {
    Alert.alert(t("changeServerTitle"), t("changeServerMessage"), [
      { text: t("clearCacheCancel"), style: "cancel" },
      { text: t("changeServerConfirm"), style: "destructive",
        onPress: () => changeServer.mutate(undefined, {
          onSettled: () => { setServerUrl(null); router.replace("/(auth)/server-setup"); },
        }),
      },
    ]);
  }, [t, changeServer, setServerUrl, router]);

  const handleClearCache = useCallback(() => {
    Alert.alert(t("clearCacheTitle"), t("clearCacheMessage"), [
      { text: t("clearCacheCancel"), style: "cancel" },
      { text: t("clearCacheConfirm"), style: "destructive",
        onPress: () => { storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup"); },
      },
    ]);
  }, [t, queryClient, router, storage]);

  const handleDeleteAccount = useCallback(() => {
    if (isAdmin) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError")); return; }
    Alert.alert(t("deleteAccountTitle"), t("deleteAccountMessage"), [
      { text: t("deleteAccountCancel"), style: "cancel" },
      { text: t("deleteAccountConfirm"), style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const serverUrl = storage.getItem("tentacle_server_url");
            const token = storage.getItem("tentacle_token");
            if (!serverUrl || !token) return;
            const res = await fetch(`${serverUrl}/api/auth/account`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 403) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountAdminError")); return; }
            if (!res.ok) { Alert.alert(t("deleteAccountTitle"), t("deleteAccountError")); return; }
            storage.clear?.(); queryClient.clear(); router.replace("/(auth)/server-setup");
          } catch { Alert.alert(t("deleteAccountTitle"), t("deleteAccountError")); }
          finally { setDeleting(false); }
        },
      },
    ]);
  }, [t, isAdmin, storage, queryClient, router]);

  return (
    <SubtleBackground ambient>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: spacing.screenPadding, paddingTop: spacing.xl }}>
          {/* Hero — avatar gradient XL + nom + badge admin */}
          <FadeIn delay={0}>
            <View style={st.hero}>
              <LinearGradient
                colors={[BRAND.dark, BRAND.violet, BRAND.light]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={st.avatar}
              >
                <Text style={st.avatarTxt}>{initial}</Text>
              </LinearGradient>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.heroName} numberOfLines={1}>{userName}</Text>
                {isAdmin ? <Badge label={t("adminBadge")} variant="brand" /> : <Text style={st.heroSub}>{t("title")}</Text>}
              </View>
            </View>
          </FadeIn>

          {/* Quick actions row — 3 cards icon glass */}
          <FadeIn delay={80}>
            <View style={st.quickRow}>
              <QuickActionCard iconName="monitor" label={t("pairTV")} onPress={() => router.push("/pair-tv")} />
              <QuickActionCard iconName="help-circle" label={t("support")} onPress={() => router.push("/support")} />
              <QuickActionCard iconName="info" label={t("about")} onPress={() => router.push("/about")} />
            </View>
          </FadeIn>

          {/* Préférences */}
          <FadeIn delay={160}>
            <SectionHeader title={t("preferences")} />
            <GlassCard style={{ marginBottom: spacing.xl }}>
              <LanguageToggle />
              <View style={st.divider} />
              <MediaPreferencesSection />
            </GlassCard>
          </FadeIn>

          {/* Appareils appairés */}
          <FadeIn delay={240}><PairedDevicesSection /></FadeIn>

          {/* Admin */}
          {isAdmin && <FadeIn delay={320}><AdminSection /></FadeIn>}

          {/* Privacy */}
          <FadeIn delay={360}>
            <Pressable
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              accessibilityRole="link"
              accessibilityLabel={t("privacyPolicy")}
              style={st.privacy}
              hitSlop={8}
            >
              <Feather name="external-link" size={13} color={colors.textMuted} />
              <Text style={st.privacyTxt}>{t("privacyPolicy")}</Text>
            </Pressable>
          </FadeIn>

          {/* Danger zone — consolidée en liste compacte */}
          <FadeIn delay={400}>
            <SectionHeader title={t("dangerZone")} danger />
            <View style={st.dangerList}>
              <DangerRow icon="server" label={t("changeServer")} onPress={handleChangeServer} />
              <DangerRow icon="trash-2" label={t("clearCache")} onPress={handleClearCache} />
              <DangerRow icon="user-x" label={t("deleteAccount")} onPress={handleDeleteAccount} disabled={deleting} />
              <DangerRow icon="log-out" label={t("logout")} onPress={handleLogout} variant="logout" />
            </View>
          </FadeIn>

          <View style={{ marginTop: spacing.xl, alignItems: "center" }}>
            <Text style={st.versionTxt}>Tentacle TV v{appVersion}</Text>
          </View>
        </View>
      </ScrollView>
    </SubtleBackground>
  );
}

function SectionHeader({ title, danger }: { title: string; danger?: boolean }) {
  return (
    <Text style={[st.sectionTitle, danger && { color: STATUS.error }]} accessibilityRole="header">
      {title}
    </Text>
  );
}

function QuickActionCard({ iconName, label, onPress }: { iconName: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={label}>
      <GlassCard>
        <View style={{ alignItems: "center", gap: 10 }}>
          <View style={st.quickIcon}>
            <Feather name={iconName as keyof typeof Feather.glyphMap} size={20} color={BRAND.light} />
          </View>
          <Text style={st.quickLabel} numberOfLines={2}>{label}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

function LanguageToggle() {
  const { t, i18n } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const currentLang = i18n.language?.startsWith("fr") ? "fr" : "en";
  const switchLanguage = (lng: string) => { i18n.changeLanguage(lng); storage.setItem("tentacle_language", lng); };
  return (
    <View>
      <Text style={st.langLabel}>{t("language")}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }} accessibilityRole="radiogroup">
        <LangBtn active={currentLang === "fr"} label={t("french")} onPress={() => switchLanguage("fr")} />
        <LangBtn active={currentLang === "en"} label={t("english")} onPress={() => switchLanguage("en")} />
      </View>
    </View>
  );
}

function LangBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[st.langBtn, {
        backgroundColor: active ? BRAND.soft : "rgba(255,255,255,0.05)",
        borderColor: active ? "rgba(139,92,246,0.45)" : BORDER.subtle,
      }]}
    >
      <Text style={[st.langBtnTxt, { color: active ? BRAND.light : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function DangerRow({ icon, label, onPress, variant, disabled }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  variant?: "logout";
  disabled?: boolean;
}) {
  const isLogout = variant === "logout";
  const color = isLogout ? STATUS.error : "rgba(255,255,255,0.86)";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        st.dangerRow,
        isLogout && { backgroundColor: "rgba(239,68,68,0.06)" },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={[st.dangerIcon, { backgroundColor: isLogout ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)" }]}>
        <Feather name={icon} size={17} color={color} />
      </View>
      <Text style={[st.dangerLabel, { color }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.28)" />
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.lg, marginBottom: spacing.xl },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center" as const, justifyContent: "center" as const, ...SHADOW_RN.elev3 },
  avatarTxt: { fontSize: 32, fontFamily: FONT_FAMILY.extrabold, color: "#fff", letterSpacing: -0.5 },
  heroName: { ...typography.title, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: colors.textPrimary, letterSpacing: -0.4 },
  heroSub: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: colors.textMuted },
  quickRow: { flexDirection: "row" as const, gap: spacing.md, marginBottom: spacing.xxl },
  quickIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: BRAND.soft, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(139,92,246,0.25)" },
  quickLabel: { ...typography.bodyBold, fontSize: 12, fontFamily: FONT_FAMILY.semibold, color: colors.textPrimary, textAlign: "center" as const },
  sectionTitle: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md, letterSpacing: -0.2, textTransform: "uppercase" as const, opacity: 0.85 },
  divider: { height: 1, backgroundColor: BORDER.subtle, marginVertical: spacing.md },
  langLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, marginBottom: spacing.sm },
  langBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: "center" as const, borderWidth: 1 },
  langBtnTxt: { ...typography.bodyBold, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
  privacy: { marginTop: spacing.xxl, alignItems: "center" as const, flexDirection: "row" as const, justifyContent: "center" as const, gap: spacing.sm, paddingVertical: 12 },
  privacyTxt: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, textDecorationLine: "underline" as const },
  dangerList: { gap: 2 },
  dangerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: "rgba(255,255,255,0.025)" },
  dangerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center" as const, justifyContent: "center" as const },
  dangerLabel: { ...typography.bodyBold, fontFamily: FONT_FAMILY.semibold, fontSize: 14.5, flex: 1, letterSpacing: -0.1 },
  versionTxt: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: colors.textDim },
});
