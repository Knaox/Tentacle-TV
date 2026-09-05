import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react-native";
import { reasonToText } from "@tentacle-tv/api-client";
import type { RecoReason, ReasonTranslate } from "@tentacle-tv/api-client";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/** Les phrases (distinctes) que font les raisons d'une recommandation, `max` au plus. */
export function reasonTexts(reasons: readonly RecoReason[], t: ReasonTranslate, max = 3): string[] {
  const out: string[] = [];
  for (const reason of reasons) {
    const text = reasonToText(reason, t);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** La première raison qui fait une phrase — celle qu'une carte affiche. */
export function firstReasonText(reasons: readonly RecoReason[], t: ReasonTranslate): string | undefined {
  return reasonTexts(reasons, t, 1)[0];
}

interface Props {
  reasons: readonly RecoReason[];
  max?: number;
}

/**
 * « Pourquoi ce titre » : les raisons verbalisées d'une recommandation, dans
 * une feuille d'appui long. Rien si aucune raison ne fait une phrase.
 */
export function RecoReasonList({ reasons, max = 3 }: Props) {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const texts = reasonTexts(reasons, t, max);
  if (texts.length === 0) return null;
  return (
    <View style={st.root}>
      <Text style={st.title}>{t("whyTitle")}</Text>
      {texts.map((text) => (
        <View key={text} style={st.row}>
          <Sparkles size={13} color={theme.colors.brand.light} strokeWidth={2} />
          <Text style={st.text}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { gap: 6 },
  title: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 2 },
  row: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: spacing.sm },
  text: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, flex: 1 },
});
