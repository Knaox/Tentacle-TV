import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";

import {
  spacing,
  typography,
  FONT_FAMILY,
  LETTER_SPACING,
  RADIUS,
  useThemedStyles,
  type AppTheme,
} from "@/theme";

interface Props {
  /** Titre de section en capitales (ex. « COMPTE »). */
  title?: string;
  /** Sous-texte optionnel sous le titre. */
  caption?: string;
  children: ReactNode;
}

/**
 * Groupe de réglages façon iOS/Android : en-tête discret + carte à surface
 * élevée regroupant des SettingsRow séparés par des hairlines.
 */
export function SettingsSection({ title, caption, children }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      {title ? <Text style={st.title}>{title}</Text> : null}
      <View style={st.card}>{children}</View>
      {caption ? <Text style={st.caption}>{caption}</Text> : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { marginBottom: spacing.xl },
    title: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: LETTER_SPACING.wide,
      color: t.colors.text.tertiary,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: t.colors.surface.s1,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      overflow: "hidden",
    },
    caption: {
      ...typography.small,
      color: t.colors.text.quaternary,
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
      lineHeight: 17,
    },
  });
