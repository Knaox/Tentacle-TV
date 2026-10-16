import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PARENTAL_AGES_SECTION, parentalAgeChipKey } from "@tentacle-tv/tv-core";
import { Chip } from "../../controls/Chip";
import { FocusSection } from "../../focus/FocusSection";
import { Icon } from "../../icons/Icon";
import { colors, text } from "../../theme/tokens";
import type { ParentalAgeView } from "./parentalTypes";

/**
 * L'ÂGE MAXIMAL : une rangée de pastilles, du plus strict au plus large ; le
 * palier retenu est appuyé et coché (jamais la couleur seule). OK sur une
 * pastille l'enregistre aussitôt. Sous la rangée, ce qui passe en une phrase,
 * puis — si le compte de rattachement est plus strict — le plafond que
 * Jellyfin appliquera.
 *
 * Clés : `parental:age:<palier>` ; section `parental:ages` (entrée : le palier
 * retenu, posée par l'intégration).
 */
export const ParentalAgeSection = memo(function ParentalAgeSection({ age, onAge }: { age: ParentalAgeView; onAge?: (key: string) => void }) {
  const { t } = useTranslation("parentalTv");
  return (
    <View>
      <Text style={styles.title}>{t("age.title")}</Text>
      <Text style={styles.summary}>{age.summary}</Text>
      <FocusSection focusKey={PARENTAL_AGES_SECTION} style={styles.chips}>
        {age.chips.map((chip) => (
          <Chip
            key={chip.key}
            focusKey={parentalAgeChipKey(chip.key)}
            label={chip.label}
            detail={chip.detail}
            icon={chip.selected ? "check" : undefined}
            selected={chip.selected}
            accessibilityLabel={chip.selected ? `${chip.label}, ${t("age.selected")}` : chip.label}
            onPress={onAge ? () => onAge(chip.key) : undefined}
          />
        ))}
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
  title: { ...text.rowTitle },
  summary: { ...text.meta, marginTop: 8 },
  // Une marge où la pastille focalisée grandit sans être coupée.
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 24, paddingVertical: 6 },
  ceiling: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, maxWidth: 820 },
  ceilingText: { ...text.caption, flexShrink: 1 },
});
