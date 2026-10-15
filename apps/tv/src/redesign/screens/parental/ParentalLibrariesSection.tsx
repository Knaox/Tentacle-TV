import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PARENTAL_LIBRARIES_SECTION, parentalLibraryRowKey } from "@tentacle-tv/tv-core";
import { FocusSection } from "../../focus/FocusSection";
import { FocusTarget } from "../../focus/FocusTarget";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { CheckBox } from "../railSetup/LibraryRow";
import { NavRowSurface } from "../settings/NavOrderRow";
import type { ParentalLibrariesView, ParentalLibraryView } from "./parentalTypes";

/**
 * Les BIBLIOTHÈQUES : une case par bibliothèque que le profil verrait sans la
 * famille — cochée, il la voit ; décochée, Jellyfin la lui cache. OK bascule et
 * enregistre aussitôt. La liste défile s'il y en a beaucoup ; la dernière case
 * cochée ne se décoche pas (l'intégration le dit).
 *
 * Clés : `parental:library:<i>` ; section `parental:libraries`.
 */
export const ParentalLibrariesSection = memo(function ParentalLibrariesSection({ libraries, onLibrary }: {
  libraries: ParentalLibrariesView;
  onLibrary?: (id: string) => void;
}) {
  const { t } = useTranslation("parentalTv");
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{t("libraries.title")}</Text>
        <Text style={styles.summary}>{libraries.summary}</Text>
      </View>
      {libraries.rows.length === 0 ? (
        <Text style={styles.empty}>{t("libraries.empty")}</Text>
      ) : (
        <FocusSection focusKey={PARENTAL_LIBRARIES_SECTION} list style={styles.listBox}>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {libraries.rows.map((row, index) => (
              <LibraryLine key={row.id} index={index} row={row} onLibrary={onLibrary} />
            ))}
          </ScrollView>
        </FocusSection>
      )}
    </View>
  );
});

const ROW_HEIGHT = 76;

const LibraryLine = memo(function LibraryLine({ index, row, onLibrary }: { index: number; row: ParentalLibraryView; onLibrary?: (id: string) => void }) {
  const { t } = useTranslation("parentalTv");
  return (
    <FocusTarget
      focusKey={parentalLibraryRowKey(index)}
      form="row"
      onPress={onLibrary ? () => onLibrary(row.id) : undefined}
      accessibilityLabel={`${row.name}, ${row.checked ? t("libraries.allowed") : t("libraries.hidden")}`}
    >
      {(focused) => (
        <NavRowSurface focused={focused}>
          {(dark) => {
            const color = dark ? colors.ctaFg : row.checked ? colors.text : colors.textTertiary;
            return (
              <View style={styles.row}>
                <CheckBox checked={row.checked} dark={dark} />
                <Icon name={row.icon} size={28} color={color} strokeWidth={2.2} />
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {row.name}
                </Text>
                {row.checked ? null : <Icon name="eyeOff" size={24} color={dark ? colors.ctaFg : colors.textTertiary} />}
              </View>
            );
          }}
        </NavRowSurface>
      )}
    </FocusTarget>
  );
});

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  head: { flexDirection: "row", alignItems: "baseline", gap: 16 },
  title: { ...text.rowTitle },
  summary: { ...text.meta },
  empty: { ...text.body, marginTop: 20 },
  // Haute comme ses lignes, bornée par la page : elle défile quand elle déborde.
  listBox: { flexShrink: 1, marginTop: 18 },
  // Une marge où la ligne focalisée grandit sans être coupée par le bord du défilement.
  list: { gap: 12, paddingVertical: 8, paddingHorizontal: 10 },
  row: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 26 },
  label: { ...fonts.semibold, fontSize: 27, flex: 1 },
});
