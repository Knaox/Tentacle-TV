/**
 * Octave (mobile) — « Gérer les profils » DANS Octave (`/octave/profiles`, comme le bureau) : la page Famille de
 * Tentacle (`FamilyPane`), dans la page du mode. Les mêmes gestes, les mêmes droits (le serveur décide) ; rien à
 * y faire (serveur sans Famille, compte sans famille ni invitation) : retour au hub.
 */

import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { FamilyPane } from "@/screens/family/FamilyScreen";
import { OctavePage, useOctaveColors, useOctaveLayout } from "../layout";
import type { OctaveScreenProps } from "../registry/octaveRegistryTypes";

const MAX_WIDTH = 720;

export function OctaveProfilesRoute(_props: OctaveScreenProps) {
  const { t } = useTranslation("octaveShell");
  const router = useRouter();
  const colors = useOctaveColors();
  const { gutter } = useOctaveLayout();
  const onGone = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(octavePaths.account as Href);
  }, [router]);
  return (
    <OctavePage title={t("profiles.title")} subtitle={t("settings.kicker")} back>
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <Text style={[styles.lead, { color: colors.textSecondary }]}>{t("profiles.lead")}</Text>
        <FamilyPane onGone={onGone} />
      </View>
    </OctavePage>
  );
}

const styles = StyleSheet.create({
  column: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", paddingBottom: 24 },
  lead: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
});
