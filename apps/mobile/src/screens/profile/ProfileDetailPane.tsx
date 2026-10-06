import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ProfilePaneContext } from "./ProfilePaneContext";
import { KeyboardAvoidingArea } from "@/components/ui";
import { PROFILE_PANE_REGISTRY } from "./profilePaneRegistry";
import type { ProfilePaneId } from "./profilePanes";
import { ProfileSectionBody } from "./ProfileSectionBody";
import { sectionTarget, type ProfileContext, type ProfileSection } from "./profileStructure";

/** Au-delà, une ligne de réglage devient une piste d'atterrissage. */
const DETAIL_MAX_WIDTH = 680;

interface Props {
  section: ProfileSection;
  ctx: ProfileContext;
  topInset: number;
  bottomInset: number;
}

/**
 * La colonne de détail du profil tablette : la page de la rubrique choisie
 * à gauche, puis — un cran plus bas, jamais deux — le volet qu'une de ses
 * lignes ouvre, avec « ‹ Rubrique » pour remonter. Les écrans à part
 * (statistiques, support, sessions…) s'ouvrent comme sur téléphone. Changer
 * de rubrique remonte le volet (le parent monte la colonne par `key`).
 */
export function ProfileDetailPane({ section, ctx, topInset, bottomInset }: Props) {
  const { t } = useTranslation();
  const st = useThemedStyles(makeStyles);
  const [opened, setOpened] = useState<ProfilePaneId | null>(null);
  const target = sectionTarget(section, ctx);
  const direct = target.kind === "pane" ? target.id : null;
  const pane = direct ?? opened;
  const sectionLabel = t(section.label.key, { ns: section.label.ns });
  const entry = pane ? PROFILE_PANE_REGISTRY[pane] : null;
  // L'espace passe à l'appel : un `useTranslation(ns)` dont l'espace change
  // d'un volet à l'autre, sans remontage, rendait la clé brute.
  const title = entry ? t(entry.title.key, { ns: entry.title.ns }) : sectionLabel;

  return (
    <KeyboardAvoidingArea ios={false} style={st.scroll}>
      <ScrollView
        key={pane ?? "page"}
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingTop: topInset + spacing.xl, paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        indicatorStyle={Platform.OS === "ios" ? "white" : "default"}
      >
        <View style={st.column}>
          {opened && !direct ? <BackToSection label={sectionLabel} onPress={() => setOpened(null)} /> : null}
          <Text style={st.title} accessibilityRole="header">{title}</Text>
          {entry ? (
            <entry.Component />
          ) : (
            <ProfilePaneContext.Provider value={setOpened}>
              <ProfileSectionBody section={section} ctx={ctx} />
            </ProfilePaneContext.Provider>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingArea>
  );
}

/** « ‹ Lecture » : remonter du volet à la page de sa rubrique. */
function BackToSection({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`${t("back")} : ${label}`}
      style={({ pressed }) => [st.back, pressed && st.backPressed]}
    >
      <Feather name="chevron-left" size={20} color={theme.colors.brand.light} />
      <Text style={st.backLabel}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.xl },
  column: { width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" as const },
  title: { ...typography.title, color: t.colors.text.primary, marginBottom: spacing.lg },
  back: { flexDirection: "row" as const, alignItems: "center" as const, alignSelf: "flex-start" as const, minHeight: 44, marginBottom: spacing.xs, marginLeft: -6 },
  backPressed: { opacity: 0.6 },
  backLabel: { ...typography.body, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.light },
});
