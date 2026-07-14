import { useState, useCallback, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, Alert, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTentacleConfig } from "@tentacle-tv/api-client";
import { spacing, typography, FONT_FAMILY, useContentPadding, useResponsive, useThemeMode, useTheme, useThemedStyles, type AppTheme, type ThemeMode } from "../theme";
import { Badge, FadeIn, GlassCard, SubtleBackground } from "../components/ui";
import { SettingsSection, SettingsRow } from "../components/settings";
import { LanguageToggle } from "../components/profile/LanguageToggle";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { clearCredentials } from "../auth/credentialManager";
import { useServerUrl } from "../providers/ServerUrlContext";

// Version du binaire natif (patchée par les CI par plateforme) ; app.json = repli.
const appVersion: string = Application.nativeApplicationVersion ?? require("../../app.json").expo?.version ?? "1.0.0";
const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};

/**
 * Profil — hub de réglages : identité en tête, puis sections logiques
 * (Compte, Préférences, TV, Administration, Aide, Serveur, Zone sensible).
 * Les domaines lourds (Apparence, Lecture, Appareils, Invitations, Mot de
 * passe) vivent dans des sous-écrans dédiés `/settings/*`.
 */
export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { t: tp } = useTranslation("preferences");
  const router = useRouter();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { mode } = useThemeMode();
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
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";

  const handleLogout = useCallback(() => {
    logout.mutate(undefined, { onSuccess: () => { clearCredentials(storage); router.replace("/(auth)/login"); } });
  }, [logout, storage, router]);

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
  }, [t, isAdmin, storage, serverUrl, queryClient, router]);

  const contentPad = useContentPadding();
  const { isTablet, isLandscape } = useResponsive();
  const twoCol = isTablet && isLandscape;

  const leftCol: ReactNode = (
    <>
      <FadeIn delay={0}>
        <View style={st.hero}>
          <ProfileAvatar user={user} initial={initial} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={st.heroName} numberOfLines={1}>{userName}</Text>
            {isAdmin ? <Badge label={t("adminBadge")} variant="brand" /> : <Text style={st.heroSub}>{t("title")}</Text>}
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <SettingsSection title={t("account")}>
          <SettingsRow icon="lock" label={t("password")} chevron onPress={() => router.push("/settings/password")} />
          <SettingsRow icon="smartphone" label={t("pairedDevices")} chevron last onPress={() => router.push("/settings/devices")} />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={140}>
        <SettingsSection title={t("preferences")}>
          <SettingsRow icon="sun" label={t("appearance")} value={tp(THEME_MODE_LABEL[mode])} chevron onPress={() => router.push("/settings/appearance")} />
          <SettingsRow icon="play-circle" label={t("playback")} chevron last onPress={() => router.push("/settings/playback")} />
        </SettingsSection>
        <GlassCard style={st.langCard}>
          <LanguageToggle />
        </GlassCard>
      </FadeIn>

      <FadeIn delay={200}>
        <SettingsSection title={t("pairTV")}>
          <SettingsRow icon="cast" label={t("pairTV")} chevron last onPress={() => router.push("/pair-tv")} />
        </SettingsSection>
      </FadeIn>
    </>
  );

  const rightCol: ReactNode = (
    <>
      {isAdmin ? (
        <FadeIn delay={260}>
          <SettingsSection title={t("administration")}>
            <SettingsRow icon="mail" label={t("invitations")} chevron last onPress={() => router.push("/settings/invites")} />
          </SettingsSection>
        </FadeIn>
      ) : null}

      <FadeIn delay={300}>
        <SettingsSection title={t("help")}>
          <SettingsRow icon="help-circle" label={t("support")} chevron onPress={() => router.push("/support")} />
          <SettingsRow icon="info" label={t("about")} chevron last onPress={() => router.push("/about")} />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={340}>
        <SettingsSection title={t("serverSection")} caption={serverUrl || undefined}>
          <SettingsRow icon="server" label={t("changeServer")} chevron last onPress={handleChangeServer} />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={380}>
        <SettingsSection title={t("dangerZone")}>
          <SettingsRow icon="trash-2" label={t("clearCache")} destructive onPress={handleClearCache} />
          <SettingsRow icon="user-x" label={t("deleteAccount")} destructive disabled={deleting} onPress={handleDeleteAccount} />
          <SettingsRow icon="log-out" label={t("logout")} destructive last onPress={handleLogout} />
        </SettingsSection>
      </FadeIn>

      <Pressable
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
        accessibilityRole="link"
        accessibilityLabel={t("privacyPolicy")}
        style={st.privacy}
        hitSlop={8}
      >
        <Feather name="external-link" size={13} color={theme.colors.text.tertiary} />
        <Text style={st.privacyTxt}>{t("privacyPolicy")}</Text>
      </Pressable>

      <View style={st.versionWrap}>
        <Text style={st.versionTxt}>{t("version", { version: appVersion })}</Text>
      </View>
    </>
  );

  return (
    <SubtleBackground ambient>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {twoCol ? (
          <View style={st.twoCol}>
            <View style={{ flex: 1 }}>{leftCol}</View>
            <View style={{ flex: 1 }}>{rightCol}</View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: contentPad, paddingTop: spacing.xl }}>
            {leftCol}
            {rightCol}
          </View>
        )}
      </ScrollView>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.lg, marginBottom: spacing.xl },
  heroName: { ...typography.title, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
  heroSub: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  langCard: { marginTop: -spacing.md, marginBottom: spacing.xl },
  twoCol: { flexDirection: "row" as const, gap: spacing.xl, width: "100%", maxWidth: 940, alignSelf: "center" as const, paddingHorizontal: spacing.screenPadding, paddingTop: spacing.xl },
  privacy: { marginTop: spacing.sm, alignItems: "center" as const, flexDirection: "row" as const, justifyContent: "center" as const, gap: spacing.sm, paddingVertical: 12 },
  privacyTxt: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, textDecorationLine: "underline" as const },
  versionWrap: { marginTop: spacing.lg, alignItems: "center" as const },
  versionTxt: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary },
});
