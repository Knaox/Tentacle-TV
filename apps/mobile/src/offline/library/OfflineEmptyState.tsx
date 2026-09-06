import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { ConnectivitySheet } from "@/offline/ConnectivitySheet";
import { useConnectivity } from "@/offline/useConnectivity";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  /** Ouvert depuis l'écran de gestion : le retour vaut mieux qu'un conseil. */
  standalone: boolean;
}

/**
 * L'état vide du catalogue local, dessiné : un disque de marque, le titre, le
 * conseil, et l'issue qui convient — retour à l'accueil quand on est en ligne,
 * « Repasser en ligne » quand on s'est mis hors ligne à la main.
 */
export function OfflineEmptyState({ standalone }: Props) {
  const { t } = useTranslation(["offline", "downloads", "common"]);
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();
  const { state } = useConnectivity();
  const [sheet, setSheet] = useState(false);
  const online = state === "online" || state === "checking";
  const generic = standalone || online;

  return (
    <View style={st.wrap}>
      <View style={st.disc} collapsable={false}>
        <Feather name="smartphone" size={40} color={colors.brand.light} />
      </View>
      <Text style={st.title} accessibilityRole="header">{t(generic ? "offline:emptyTitle" : "offline:libraryEmptyTitle")}</Text>
      <Text style={st.message}>{t(generic ? "offline:emptyMessage" : "offline:libraryEmptyMessage")}</Text>
      {online ? (
        <Button title={t("offline:emptyGoHome")} variant="secondary" onPress={() => backOrHome(router)} style={st.cta} />
      ) : state === "offline-manual" ? (
        <Button title={t("downloads:offlineGoOnline")} variant="ghost" onPress={() => setSheet(true)} style={st.cta} />
      ) : null}
      <ConnectivitySheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingBottom: 80 },
    disc: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.brand.soft,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.brand.violet, 0.35, t.colors.brand.glow),
      marginBottom: spacing.md,
    },
    title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center" },
    message: { ...typography.body, color: t.colors.text.tertiary, textAlign: "center", lineHeight: 21, maxWidth: 360 },
    cta: { marginTop: spacing.lg, minWidth: 200 },
  });
