/**
 * Octave mobile — la recherche d'un lien SHAZAM, le temps que son titre soit nommé (`useSharedLinkSearch`) : une
 * phrase, puis la recherche du titre prend la place. Lien sans titre à chercher : dit, sans erreur.
 */

import { memo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { typography, useTheme } from "@/theme";

export const SharedLinkStatus = memo(function SharedLinkStatus({ failed, gutter }: { failed: boolean; gutter: number }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: gutter, paddingTop: 16 }} accessibilityLiveRegion="polite">
      <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{failed ? t("search.sharedLinkFailed") : t("search.sharedLinkReading")}</Text>
    </View>
  );
});
