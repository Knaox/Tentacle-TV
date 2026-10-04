import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { spacing, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";
import type { ProfileContext } from "./profileStructure";

// Version du binaire natif (patchée par les CI par plateforme) ; app.json = repli.
const appVersion: string = Application.nativeApplicationVersion ?? require("../../../app.json").expo?.version ?? "1.0.0";

/**
 * « Mes statistiques », sous l'identité : un écran plein, pas une rubrique —
 * ce qu'on vient regarder, pas régler. Il parle au serveur : absent hors ligne.
 */
export function ProfileStatsCard({ ctx }: { ctx: ProfileContext }) {
  const { t } = useTranslation("profile");
  const router = useRouter();
  if (ctx.offline) return null;
  return (
    <SettingsSection>
      <SettingsRow icon="pie-chart" label={t("stats")} description={t("statsHint")} accent chevron last onPress={() => router.push("/stats")} />
    </SettingsSection>
  );
}

/**
 * Le bas de la liste : « Se déconnecter », seul dans sa carte et après les
 * rubriques (on le touche, mais jamais par mégarde), puis la version.
 */
export function ProfileFooter({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation("profile");
  const st = useThemedStyles(makeStyles);
  return (
    <>
      <SettingsSection>
        <SettingsRow icon="log-out" label={t("logout")} destructive last onPress={onLogout} />
      </SettingsSection>
      <Text style={st.version}>{t("version", { version: appVersion })}</Text>
    </>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  version: {
    fontSize: 11, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary,
    textAlign: "center" as const, marginTop: spacing.sm,
  },
});
