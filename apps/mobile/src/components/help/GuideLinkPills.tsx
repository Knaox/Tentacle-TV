import { memo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { resolveGuideLink, type TrailerGuideLink, type TrailerGuideLinkContext } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Les liens d'une étape du guide, en pilules de 44 (la cible d'un doigt). Ne
 * paraissent que ceux qui mènent quelque part pour CE compte : le tableau de
 * bord de Jellyfin et l'administration de Tentacle — ouverte dans le
 * navigateur, le téléphone n'en a pas — restent aux administrateurs. La
 * flèche oblique dit qu'on quitte l'application.
 */
export const GuideLinkPills = memo(function GuideLinkPills({
  links,
  ctx,
}: {
  links: readonly TrailerGuideLink[];
  ctx: TrailerGuideLinkContext;
}) {
  const { t } = useTranslation("trailerHelp");
  const router = useRouter();
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const entries = links.flatMap((link) => {
    const target = resolveGuideLink(link, ctx);
    return target ? [{ link, target }] : [];
  });
  if (entries.length === 0) return null;

  return (
    <View style={st.row}>
      {entries.map(({ link, target }) => (
        <Pressable
          key={link.labelKey}
          accessibilityRole="link"
          accessibilityLabel={target.external ? `${t(link.labelKey)}, ${t("linkOpensOutside")}` : t(link.labelKey)}
          onPress={() => (target.external ? void Linking.openURL(target.href) : router.push(target.href as Href))}
          style={({ pressed }) => [st.pill, pressed && st.pressed]}
        >
          <Text style={st.label}>{t(link.labelKey)}</Text>
          <Feather
            name={target.external ? "arrow-up-right" : "chevron-right"}
            size={15}
            color={theme.colors.text.secondary}
          />
        </Pressable>
      ))}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    pill: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
    },
    pressed: { opacity: 0.7 },
    label: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
