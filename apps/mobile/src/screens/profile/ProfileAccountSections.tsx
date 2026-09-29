import { Text, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { FadeIn } from "@/components/ui";
import type { useProfileActions } from "@/hooks/useProfileActions";
import { setManualOffline } from "@/offline/connectivityStore";
import { spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ProfilePaneRow } from "./ProfilePaneRow";
import type { PaneContext } from "./profilePanes";

// Version du binaire natif (patchée par les CI par plateforme) ; app.json = repli.
const appVersion: string = Application.nativeApplicationVersion ?? require("../../../app.json").expo?.version ?? "1.0.0";
const PRIVACY_POLICY_URL = "https://github.com/Knaox/Tentacle-TV/blob/main/PRIVACY.md";

interface Props {
  ctx: PaneContext;
  /** « Passer hors ligne » : seulement quand le serveur répond. */
  canGoOffline: boolean;
  actions: ReturnType<typeof useProfileActions>;
}

/**
 * Les sections de COMPTE du profil (6 à 9 de `profilePanes.ts`) : Aide,
 * Connexion, Compte, Zone de danger, puis la version. Les actions
 * destructives ont leur propre carte, en dernier, séparées de la
 * déconnexion qu'on touche tous les jours.
 */
export function ProfileAccountSections({ ctx, canGoOffline, actions }: Props) {
  const { t } = useTranslation("profile");
  const { t: tn } = useTranslation("nav");
  const { t: to } = useTranslation("offline");
  const { t: tg } = useTranslation("trailerHelp");
  const router = useRouter();
  const st = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { offline } = ctx;
  const { serverUrl, deleting, handleLogout, handleChangeServer, handleClearCache, handleDeleteAccount } = actions;

  return (
    <>
      <FadeIn delay={300}>
        <SettingsSection title={t("help")}>
          {!offline && <SettingsRow icon="help-circle" label={t("support")} chevron onPress={() => router.push("/support")} />}
          {!offline && <SettingsRow icon="film" label={tg("helpEntryTitle")} chevron onPress={() => router.push("/help/trailers")} />}
          <SettingsRow icon="info" label={t("about")} chevron onPress={() => router.push("/about")} />
          <SettingsRow
            icon="shield"
            label={t("privacyPolicy")}
            // L'icône « sortie » dit que la page s'ouvre hors de l'app.
            trailing={<Feather name="external-link" size={16} color={theme.colors.text.quaternary} style={st.external} />}
            last
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          />
        </SettingsSection>
      </FadeIn>

      {(!offline || canGoOffline) && (
        <FadeIn delay={330}>
          <SettingsSection title={to("sectionConnection")}>
            {!offline && (
              <SettingsRow icon="server" label={t("changeServer")} description={serverUrl || undefined} chevron last={!canGoOffline} onPress={handleChangeServer} />
            )}
            {canGoOffline && (
              <SettingsRow icon="wifi-off" label={tn("goOffline")} description={to("goOfflineHint")} last onPress={() => setManualOffline(true)} />
            )}
          </SettingsSection>
        </FadeIn>
      )}

      <FadeIn delay={360}>
        <SettingsSection title={t("account")}>
          {!offline && <ProfilePaneRow pane="password" icon="lock" label={t("password")} />}
          <SettingsRow icon="log-out" label={t("logout")} destructive last onPress={handleLogout} />
        </SettingsSection>
      </FadeIn>

      {!offline && (
        <FadeIn delay={390}>
          <SettingsSection title={t("dangerZone")}>
            <SettingsRow icon="trash-2" label={t("clearCache")} destructive onPress={handleClearCache} />
            <SettingsRow icon="user-x" label={t("deleteAccount")} destructive last disabled={deleting} onPress={handleDeleteAccount} />
          </SettingsSection>
        </FadeIn>
      )}

      <Text style={st.version}>{t("version", { version: appVersion })}</Text>
    </>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  external: { paddingLeft: spacing.xs },
  version: {
    fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary,
    textAlign: "center" as const, marginTop: spacing.sm,
  },
});
