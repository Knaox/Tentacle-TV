import { memo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTrailerHint } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { Colors, Fonts } from "../../theme/colors";

/**
 * « Vous ne voyez pas les bandes-annonces ? » au téléviseur : une PHRASE qui
 * renvoie vers l'app web ou mobile (Aide › Bandes-annonces), ni lien ni
 * bouton — un guide ne se lit pas à la télécommande, et rien de focalisable
 * ne s'ajoute à la fiche. Même règle que partout (`useTrailerHint`) : un
 * titre sans AUCUNE bande-annonce, un serveur mal réglé, un rappel que le
 * compte n'a pas masqué (depuis le téléphone ou le web : le téléviseur
 * l'apprend en direct).
 *
 * Posée sous l'en-tête de la fiche, au pied des actions, en tertiaire.
 */
export const TVTrailerHint = memo(function TVTrailerHint({
  item,
  trailer,
}: {
  item: MediaItem;
  trailer: { visible: boolean; settled: boolean };
}) {
  const { t } = useTranslation("trailerHelp");
  const { show } = useTrailerHint({ itemType: item.Type, trailerVisible: trailer.visible, trailerSettled: trailer.settled });
  if (!show) return null;

  return (
    <View focusable={false} style={{ paddingHorizontal: TV_OVERSCAN_PT.x, marginTop: 16 }}>
      <Text style={{ maxWidth: 900, color: Colors.textTertiary, fontSize: 17, lineHeight: 24, fontFamily: Fonts.regular }}>
        {t("hintTv")}
      </Text>
    </View>
  );
});
