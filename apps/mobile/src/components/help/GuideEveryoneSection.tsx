import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { TRAILER_GUIDE_NOTES, TRAILER_GUIDE_SOURCES } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { GUIDE_FEATHER, makeGuideStyles } from "./guideStyles";

function Block({ title, children }: { title: string; children: ReactNode }) {
  const g = useThemedStyles(makeGuideStyles);
  return (
    <View style={{ marginTop: spacing.xl + 4 }}>
      <Text style={g.blockTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * « Pour tous », comme sur le web : ce n'est pas vous, d'où viennent les
 * bandes-annonces, qui peut agir, et ce qu'il est bon de savoir. Un
 * administrateur est renvoyé à sa partie d'un geste (`onSeeSteps`).
 */
export const GuideEveryoneSection = memo(function GuideEveryoneSection({
  isAdmin,
  onSeeSteps,
}: {
  isAdmin: boolean;
  onSeeSteps: () => void;
}) {
  const { t } = useTranslation("trailerHelp");
  const theme = useTheme();
  const g = useThemedStyles(makeGuideStyles);
  const st = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={g.partTitle} accessibilityRole="header">
        {t("partEveryone")}
      </Text>

      <Block title={t("notYouTitle")}>
        <Text style={g.paragraph}>{t("notYouBody")}</Text>
      </Block>

      <Block title={t("sourcesTitle")}>
        {TRAILER_GUIDE_SOURCES.map((source) => (
          <View key={source.id} style={[g.card, st.source]}>
            <View style={st.sourceHead}>
              <View style={g.iconBox}>
                <Feather name={GUIDE_FEATHER[source.icon]} size={18} color={theme.colors.text.secondary} />
              </View>
              <Text style={st.sourceTitle}>{t(source.titleKey)}</Text>
            </View>
            <Text style={[g.small, st.sourceBody]}>{t(source.bodyKey)}</Text>
          </View>
        ))}
      </Block>

      <Block title={t("whatToDoTitle")}>
        <Text style={g.paragraph}>{t("whatToDoBody")}</Text>
        {isAdmin && (
          <View style={st.adminBox}>
            <Text style={st.adminText}>{t("whatToDoAdmin")}</Text>
            <Pressable accessibilityRole="button" onPress={onSeeSteps} style={({ pressed }) => [st.adminLinkWrap, pressed && st.pressed]}>
              <Text style={st.adminLink}>{t("whatToDoAdminLink")}</Text>
            </Pressable>
          </View>
        )}
      </Block>

      <Block title={t("notesTitle")}>
        {TRAILER_GUIDE_NOTES.map((note) => (
          <View key={note.key} style={st.note}>
            <Feather name={GUIDE_FEATHER[note.icon]} size={17} color={theme.colors.text.tertiary} style={st.noteIcon} />
            <Text style={[g.paragraph, st.noteText]}>{t(note.key)}</Text>
          </View>
        ))}
      </Block>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    source: { marginTop: spacing.md },
    sourceHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    sourceTitle: { flex: 1, fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    sourceBody: { marginTop: spacing.sm + 2 },
    adminBox: {
      marginTop: spacing.md,
      padding: spacing.md + 2,
      borderRadius: RADIUS.lg,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.12, t.colors.fill.soft),
    },
    adminText: { fontSize: 14, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.primary },
    // 44 de haut : la cible d'un doigt, même pour un lien d'une ligne.
    adminLinkWrap: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    adminLink: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, textDecorationLine: "underline" },
    pressed: { opacity: 0.7 },
    note: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
    noteIcon: { marginTop: spacing.sm + 3 },
    noteText: { flex: 1 },
  });
