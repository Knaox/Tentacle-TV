import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useTrailerReadiness } from "@tentacle-tv/api-client";
import { describeTrailerReadiness } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Sur ce serveur » : le diagnostic des bandes-annonces, en tête du guide —
 * le même encadré que la page du web. Mal réglé : les causes, dans l'ordre où
 * les traiter ; bien réglé : un titre sans bande-annonce n'en a simplement
 * pas ; inconnu : rien. L'heure de la mesure n'est dite qu'à l'administrateur.
 */
export const GuideStatusNotice = memo(function GuideStatusNotice({ isAdmin }: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation("trailerHelp");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { data } = useTrailerReadiness();
  const summary = describeTrailerReadiness(data);
  if (!summary) return null;

  const pair = theme.colors.statusPairs[summary.state === "ready" ? "success" : "warning"];
  const checkedAt = data?.checkedAt ? new Date(data.checkedAt) : null;
  const time = checkedAt && !Number.isNaN(checkedAt.getTime())
    ? checkedAt.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <View style={[st.box, { backgroundColor: pair.bg }]}>
      <Feather name={summary.state === "ready" ? "check-circle" : "alert-triangle"} size={16} color={pair.fg} style={st.icon} />
      <View style={st.body}>
        <Text style={[st.title, { color: pair.fg }]}>{t("statusTitle")}</Text>
        <Text style={st.text}>{t(summary.messageKey)}</Text>
        {summary.reasons.map((reason) => (
          <Text key={reason.reason} style={st.text}>
            {`•  ${t(reason.key, reason.values)}`}
          </Text>
        ))}
        {isAdmin && time && <Text style={st.time}>{t("statusCheckedAt", { time })}</Text>}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    box: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, padding: spacing.md + 2, borderRadius: RADIUS.lg },
    icon: { marginTop: 2 },
    body: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: 14, fontFamily: FONT_FAMILY.semibold },
    text: { fontSize: 14, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    time: { marginTop: 2, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
