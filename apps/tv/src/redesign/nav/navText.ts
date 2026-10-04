import { StyleSheet } from "react-native";
import { fonts } from "../theme/tokens";

/**
 * Les textes du rail, en un seul endroit : les entrées les dessinent, la
 * mesure hors écran (`NavTextMeasure`) les mesure avec EXACTEMENT les mêmes
 * styles — la largeur du rail ouvert en dépend.
 */
export const navText = StyleSheet.create({
  /** Le libellé d'une entrée au repos. */
  label: { ...fonts.semibold, fontSize: 26 },
  /** Le libellé de l'entrée active, focalisée ou organisée — le plus large : c'est lui qu'on mesure. */
  labelBold: { ...fonts.bold, fontSize: 26 },
  /** La seconde ligne du profil (« Réglages »). */
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 26, marginTop: -1 },
  /** Une ligne de la légende du rail ouvert. */
  hint: { ...fonts.medium, fontSize: 22, lineHeight: 30 },
});
