import { type ReactNode } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { spacing, typography, FONT_FAMILY, useContentPadding, useResponsive, useThemeMode, useTheme, useThemedStyles, type AppTheme, type ThemeMode } from "../theme";
import { Badge, Divider, FadeIn, SubtleBackground } from "../components/ui";
import { SettingsSection, SettingsRow } from "../components/settings";
import { LanguageToggle } from "../components/profile/LanguageToggle";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { useHeaderHeight } from "../components/PersistentHeader";
import { useScrollChromeHandler } from "../components/navigation/scrollChrome";
import { useProfileActions } from "../hooks/useProfileActions";

// Version du binaire natif (patchée par les CI par plateforme) ; app.json = repli.
const appVersion: string = Application.nativeApplicationVersion ?? require("../../app.json").expo?.version ?? "1.0.0";
const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};

/**
 * Profil — hub de réglages : identité en tête, puis Personnalisation (accueil
 * et recommandations), Préférences, Langue, TV ; à droite (ou dessous)
 * Administration, Aide, Sécurité (mot de passe, appareils, serveur, puis les
 * actions destructives en rouge), confidentialité, version. Les domaines
 * lourds vivent dans des sous-écrans `/settings/*` ; les actions de compte
 * dans `useProfileActions`.
 */
export function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { t: tp } = useTranslation("preferences");
  const router = useRouter();
  const headerH = useHeaderHeight();
  const onScrollChrome = useScrollChromeHandler();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { mode } = useThemeMode();
  const {
    user, isAdmin, userName, initial, serverUrl, deleting,
    handleLogout, handleChangeServer, handleClearCache, handleDeleteAccount,
  } = useProfileActions();

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
        <SettingsSection title={tp("sectionPersonalization")}>
          <SettingsRow
            icon="sliders"
            label={tp("sectionPersonalization")}
            description={t("personalizationHint")}
            chevron
            last
            onPress={() => router.push("/settings/personalization")}
          />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={140}>
        <SettingsSection title={t("preferences")}>
          <SettingsRow icon="sun" label={t("appearance")} value={tp(THEME_MODE_LABEL[mode])} chevron onPress={() => router.push("/settings/appearance")} />
          <SettingsRow icon="bell" label={t("notifications")} chevron onPress={() => router.push("/settings/notifications")} />
          <SettingsRow icon="play-circle" label={t("playback")} chevron last onPress={() => router.push("/settings/playback")} />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={200}>
        <SettingsSection title={t("language")}>
          <View style={st.langWrap}>
            <LanguageToggle hideLabel />
          </View>
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={260}>
        <SettingsSection title={t("pairTV")}>
          <SettingsRow icon="cast" label={t("pairTV")} chevron last onPress={() => router.push("/pair-tv")} />
        </SettingsSection>
      </FadeIn>
    </>
  );

  const rightCol: ReactNode = (
    <>
      {isAdmin ? (
        <FadeIn delay={300}>
          <SettingsSection title={t("administration")}>
            <SettingsRow icon="mail" label={t("invitations")} chevron last onPress={() => router.push("/settings/invites")} />
          </SettingsSection>
        </FadeIn>
      ) : null}

      <FadeIn delay={340}>
        <SettingsSection title={t("help")}>
          <SettingsRow icon="help-circle" label={t("support")} chevron onPress={() => router.push("/support")} />
          <SettingsRow icon="info" label={t("about")} chevron last onPress={() => router.push("/about")} />
        </SettingsSection>
      </FadeIn>

      <FadeIn delay={380}>
        <SettingsSection title={tp("sectionSecurity")}>
          <SettingsRow icon="lock" label={t("password")} chevron onPress={() => router.push("/settings/password")} />
          <SettingsRow icon="smartphone" label={t("pairedDevices")} chevron onPress={() => router.push("/settings/devices")} />
          <SettingsRow icon="server" label={t("changeServer")} description={serverUrl || undefined} chevron last onPress={handleChangeServer} />
          {/* Les actions destructives, séparées et en rouge, ferment la carte. */}
          <Divider intensity="strong" style={st.dangerDivider} />
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
      <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: headerH, paddingBottom: 120 }} showsVerticalScrollIndicator={false} onScroll={onScrollChrome} scrollEventThrottle={16}>
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
      </Animated.ScrollView>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  hero: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.lg, marginBottom: spacing.xl },
  heroName: { ...typography.title, fontSize: 22, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.4 },
  heroSub: { ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  langWrap: { padding: spacing.md },
  dangerDivider: { marginVertical: 0 },
  twoCol: { flexDirection: "row" as const, gap: spacing.xl, width: "100%", maxWidth: 940, alignSelf: "center" as const, paddingHorizontal: spacing.screenPadding, paddingTop: spacing.xl },
  privacy: { marginTop: spacing.sm, alignItems: "center" as const, flexDirection: "row" as const, justifyContent: "center" as const, gap: spacing.sm, paddingVertical: 12 },
  privacyTxt: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, textDecorationLine: "underline" as const },
  versionWrap: { marginTop: spacing.lg, alignItems: "center" as const },
  versionTxt: { fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary },
});
