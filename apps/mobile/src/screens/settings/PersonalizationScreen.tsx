import { useCallback } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  HOME_LAYOUT_KEY, RECO_SETTINGS_KEY, useHomeLayout, useLibraries, useRecoSettings,
} from "@tentacle-tv/api-client";
import { Skeleton } from "@/components/ui";
import { PersonalizationHomeSection } from "@/components/settings/personalization/PersonalizationHomeSection";
import { PersonalizationRecoSection } from "@/components/settings/personalization/PersonalizationRecoSection";
import { spacing } from "@/theme";
import { SettingsScaffold } from "./SettingsScaffold";

/**
 * Personnalisation — l'accueil (bandeau, densité, rangées) et les réglages
 * de recommandation, comme sur le web. Relus à chaque focus : ce qu'un autre
 * appareil a changé est là à l'ouverture.
 *
 * Le VOLET est le contenu seul : l'écran l'habille de son en-tête sur
 * téléphone, le profil tablette le pose dans sa colonne de détail.
 */
export function PersonalizationScreen() {
  const { t } = useTranslation("preferences");
  return (
    <SettingsScaffold title={t("sectionPersonalization")}>
      <PersonalizationPane />
    </SettingsScaffold>
  );
}

export function PersonalizationPane() {
  const qc = useQueryClient();
  const { data: layout } = useHomeLayout();
  const { data: settings } = useRecoSettings();
  const { data: libraries } = useLibraries();

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: HOME_LAYOUT_KEY });
      void qc.invalidateQueries({ queryKey: RECO_SETTINGS_KEY });
    }, [qc]),
  );

  return (
    <>
      {layout && libraries ? (
        <PersonalizationHomeSection layout={layout} libraries={libraries} />
      ) : (
        <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
          <Skeleton width="100%" height={180} radius={16} />
        </View>
      )}
      {settings ? (
        <PersonalizationRecoSection settings={settings} />
      ) : (
        <Skeleton width="100%" height={240} radius={16} />
      )}
    </>
  );
}
