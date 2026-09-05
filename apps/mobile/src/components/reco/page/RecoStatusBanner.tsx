import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { RecoPage } from "@tentacle-tv/api-client";
import { Button } from "@/components/ui";
import { spacing, typography, RADIUS, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  page: RecoPage;
  /** Au moins une rangée hors des trois globales est annoncée. */
  hasPersonalizedRows: boolean;
  /** Rouvre la grille de démarrage à froid (phase « hold » de la page). */
  onOpenColdStart: () => void;
  /** Les réglages de personnalisation (perso coupée par l'utilisateur). */
  onOpenSettings: () => void;
}

/**
 * UN bandeau d'état à la fois — le premier vrai gagne, dans l'ordre du web :
 * la perso coupée PAR L'UTILISATEUR prime ; la clé TMDB absente ne dit RIEN
 * ici (l'admin a son bandeau, les autres n'y peuvent rien) ; puis les états de
 * calcul du profil et du pool.
 */
export function RecoStatusBanner({ page, hasPersonalizedRows, onOpenColdStart, onOpenSettings }: Props) {
  const { t } = useTranslation("reco");
  const st = useThemedStyles(makeStyles);
  const cold = page.state === "cold";

  const hint = (text: string) => <Text style={st.hint}>{text}</Text>;
  const actionable = (text: string, cta: string, onPress: () => void) => (
    <View style={st.actionable}>
      <Text style={st.actionableTxt}>{text}</Text>
      <Button title={cta} variant="secondary" onPress={onPress} style={st.cta} />
    </View>
  );

  if (page.personalized === false) return actionable(t("disabledBanner"), t("disabledBannerCta"), onOpenSettings);
  if (page.tmdbConfigured === false) return null;
  if (cold && (page.generating || page.refining)) return hint(t("generatingHint"));
  if (cold) return actionable(t("coldBannerHint"), t("coldBannerCta"), onOpenColdStart);
  if (page.exploring) return hint(t("exploringHint"));
  if (page.state === "warming") return hint(t("warmingHint"));
  if (page.generating && !hasPersonalizedRows) return hint(t("generatingHint"));
  if (page.refining && page.rows.length > 0) return hint(t("preliminaryHint"));
  return null;
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  hint: { ...typography.caption, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, marginTop: spacing.md },
  // Bloc actionnable : bord discret, fond faint — informationnel, pas une panne.
  actionable: {
    marginHorizontal: spacing.screenPadding, marginTop: spacing.md,
    padding: spacing.md, gap: spacing.sm,
    borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.subtle, backgroundColor: t.colors.fill.faint,
  },
  actionableTxt: { ...typography.caption, color: t.colors.text.secondary },
  cta: { alignSelf: "flex-start" as const },
});
