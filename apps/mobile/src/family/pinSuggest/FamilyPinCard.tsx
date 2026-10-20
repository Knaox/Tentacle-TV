import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { OwnPinSheet } from "@/components/family/PinSheet";
import { SecondaryButton } from "@/components/ui/buttons";
import { RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/**
 * La carte « Action recommandée » en tête de l'écran Famille — tant que le
 * profil n'a pas de code PIN (règle partagée, `card`). Pas de « plus tard » :
 * elle s'en va d'elle-même dès que le code est posé (la Famille relue le dit).
 * Une carte NEUTRE, aucun flou : la marque n'y tient qu'au pictogramme et au
 * surtitre, le bouton est secondaire (l'écran Famille n'a pas d'action en
 * couleur à céder à un rappel).
 */
export function FamilyPinCard() {
  const { t } = useTranslation("family");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { card } = useFamilyPinReminder();
  const [editing, setEditing] = useState(false);
  if (!card && !editing) return null;

  return (
    <>
      {card ? (
        <View style={st.card}>
          <View style={st.head}>
            <View style={st.badge}>
              <Feather name="lock" size={19} color={theme.colors.brand.light} />
            </View>
            <View style={st.texts}>
              <Text style={st.eyebrow}>{t("pinSuggest.eyebrow").toUpperCase()}</Text>
              <Text style={st.title} accessibilityRole="header">{t("pinSuggest.title")}</Text>
            </View>
          </View>
          <Text style={st.body}>{t("pinSuggest.body")}</Text>
          <SecondaryButton size="lg" fullWidth icon="lock" label={t("pinSuggest.set")} onPress={() => setEditing(true)} style={st.button} />
        </View>
      ) : null}
      {editing ? <OwnPinSheet hasPin={false} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: RADIUS.xl,
      backgroundColor: t.colors.surface.s1,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    badge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.fill.soft },
    texts: { flex: 1 },
    eyebrow: { ...typography.small, color: t.colors.brand.light, letterSpacing: 1.4 },
    title: { ...typography.subtitle, color: t.colors.text.primary, marginTop: 2 },
    body: { ...typography.body, color: t.colors.text.secondary, lineHeight: 21, marginTop: spacing.md },
    button: { marginTop: spacing.md },
  });
