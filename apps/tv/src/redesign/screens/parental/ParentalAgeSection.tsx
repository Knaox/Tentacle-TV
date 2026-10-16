import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PARENTAL_AGES_SECTION, parentalAgeOptionKey } from "@tentacle-tv/tv-core";
import { FocusSection } from "../../focus/FocusSection";
import { Icon } from "../../icons/Icon";
import { colors, text } from "../../theme/tokens";
import { ParentalRow, RadioDot } from "./ParentalRow";
import type { ParentalAgeView } from "./parentalTypes";

/**
 * L'ÂGE MAXIMAL : une liste à choix unique, du plus strict au plus large — la
 * même tenue que les bibliothèques d'à côté, et jamais une ligne orpheline
 * quelle que soit la table de Jellyfin (relevé du Testeur A, 16/10 : en
 * pastilles, « Sans limite » passait seul à la ligne). Le palier retenu a son
 * rond plein ; OK sur une ligne l'enregistre aussitôt. Sous le titre, ce qui
 * passe en une phrase ; sous la liste, le plafond que Jellyfin appliquera si le
 * compte de rattachement est plus strict.
 *
 * Clés : `parental:age:<palier>` ; section `parental:ages` (entrée : le palier
 * retenu, posée par l'intégration).
 */
export const ParentalAgeSection = memo(function ParentalAgeSection({ age, onAge }: { age: ParentalAgeView; onAge?: (key: string) => void }) {
  const { t } = useTranslation("parentalTv");
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("age.title")}</Text>
      <Text style={styles.summary}>{age.summary}</Text>
      <FocusSection focusKey={PARENTAL_AGES_SECTION} list style={styles.listBox}>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {age.options.map((option) => (
            <ParentalRow
              key={option.key}
              focusKey={parentalAgeOptionKey(option.key)}
              on={option.selected}
              label={option.label}
              detail={option.detail}
              leading={(dark) => <RadioDot selected={option.selected} dark={dark} />}
              accessibilityLabel={option.selected ? `${option.label}, ${t("age.selected")}` : option.label}
              onPress={onAge ? () => onAge(option.key) : undefined}
            />
          ))}
        </ScrollView>
      </FocusSection>
      {age.ceilingNote ? (
        <View style={styles.ceiling}>
          <Icon name="lock" size={24} color={colors.textTertiary} />
          <Text style={styles.ceilingText}>{age.ceilingNote}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  title: { ...text.rowTitle },
  summary: { ...text.meta, marginTop: 8 },
  // Haute comme ses lignes, bornée par la page : elle défile quand elle déborde.
  listBox: { flexShrink: 1, marginTop: 18 },
  // Une marge où la ligne focalisée grandit sans être coupée par le bord du défilement.
  list: { gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  ceiling: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, paddingHorizontal: 10 },
  ceilingText: { ...text.caption, flexShrink: 1 },
});
