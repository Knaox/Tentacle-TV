import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PARENTAL_LIBRARIES_SECTION, parentalLibraryRowKey } from "@tentacle-tv/tv-core";
import { FocusSection } from "../../focus/FocusSection";
import { text } from "../../theme/tokens";
import { CheckBox } from "../railSetup/LibraryRow";
import { ParentalRow } from "./ParentalRow";
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
      <Text style={styles.title}>{t("libraries.title")}</Text>
      {/* La même tenue que l'âge d'à côté : les deux listes commencent à la même hauteur. */}
      <Text style={styles.summary}>{libraries.summary || " "}</Text>
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

const LibraryLine = memo(function LibraryLine({ index, row, onLibrary }: { index: number; row: ParentalLibraryView; onLibrary?: (id: string) => void }) {
  const { t } = useTranslation("parentalTv");
  return (
    <ParentalRow
      focusKey={parentalLibraryRowKey(index)}
      on={row.checked}
      label={row.name}
      icon={row.icon}
      trailingIcon={row.checked ? undefined : "eyeOff"}
      leading={(dark) => <CheckBox checked={row.checked} dark={dark} />}
      accessibilityLabel={`${row.name}, ${row.checked ? t("libraries.allowed") : t("libraries.hidden")}`}
      onPress={onLibrary ? () => onLibrary(row.id) : undefined}
    />
  );
});

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  title: { ...text.rowTitle },
  summary: { ...text.meta, marginTop: 8 },
  empty: { ...text.body, marginTop: 20 },
  // Haute comme ses lignes, bornée par la page : elle défile quand elle déborde.
  listBox: { flexShrink: 1, marginTop: 18 },
  // Une marge où la ligne focalisée grandit sans être coupée par le bord du défilement.
  list: { gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
});
