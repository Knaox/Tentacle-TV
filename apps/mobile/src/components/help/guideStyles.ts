import type { ComponentProps } from "react";
import { Platform, StyleSheet } from "react-native";
import type { Feather } from "@expo/vector-icons";
import type { TrailerGuideIcon } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, type AppTheme } from "@/theme";

/**
 * Les pictogrammes du guide dessinés en Feather — la même correspondance que
 * le web (lucide) : le modèle partagé ne donne que leur SENS.
 */
export const GUIDE_FEATHER: Record<TrailerGuideIcon, ComponentProps<typeof Feather>["name"]> = {
  file: "file",
  globe: "globe",
  film: "film",
  smartphone: "smartphone",
  tv: "tv",
};

/** Des noms de fichiers : à chasse fixe, sur les deux systèmes. */
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/**
 * La typographie du guide, celle de la page du web ramenée au téléphone :
 * intertitres de partie à 22, blocs à 16, corps à 15 sur 23 (≈ 1,5), cartes
 * en remplissage discret bordé d'un filet.
 */
export const makeGuideStyles = (t: AppTheme) =>
  StyleSheet.create({
    partTitle: { fontSize: 22, lineHeight: 28, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    blockTitle: { fontSize: 16, lineHeight: 22, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    paragraph: { marginTop: spacing.sm, fontSize: 15, lineHeight: 23, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    small: { fontSize: 14, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    // Un filet d'1 point, pas `hairlineWidth` : le tiers de point rendait la
    // largeur du texte fractionnaire (295,33), et iOS y perdait la dernière
    // ligne de certains paragraphes (mesuré au simulateur). Le web a 1 px.
    card: {
      padding: spacing.lg,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.faint,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.soft,
    },
    exampleBox: { marginTop: spacing.md, borderRadius: RADIUS.lg, backgroundColor: t.colors.fill.subtle },
    exampleContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    example: { fontFamily: MONO, fontSize: 12, lineHeight: 20, color: t.colors.text.secondary },
  });
