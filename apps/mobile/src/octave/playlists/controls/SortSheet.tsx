/**
 * Octave mobile — « Trier par », en feuille : un choix par tri (coché), et pour le tri choisi ses deux sens
 * dits en mots (« Plus récents d'abord », « A → Z ») — jamais une flèche seule. « Personnalisé » n'a pas de
 * sens : c'est l'ordre qu'on a glissé. Choisir ferme la feuille ; le tri vaut sur tous les appareils du compte.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { defaultDirection, type MusicListDirection, type MusicListPrefs, type MusicListSortKey } from "@tentacle-tv/shared/music";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { useOctaveColors } from "../../theme/octaveColors";
import { haptic } from "@/utils/haptics";

interface Props {
  visible: boolean;
  onClose: () => void;
  prefs: MusicListPrefs;
  sorts: readonly MusicListSortKey[];
  onSort: (sort: MusicListSortKey, direction: MusicListDirection) => void;
}

const DIRECTIONS: readonly MusicListDirection[] = ["asc", "desc"];

export function SortSheet({ visible, onClose, prefs, sorts, onSort }: Props) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const pick = (sort: MusicListSortKey, direction: MusicListDirection) => {
    haptic("select");
    onSort(sort, direction);
    onClose();
  };
  const colors = useOctaveColors();
  const accent = colors.accentText;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[0.62, 0.9]}
      header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{t("listOrder.sortMenu")}</Text>}
    >
      <ScrollView contentContainerStyle={styles.body}>
        {sorts.map((sort) => {
          const selected = prefs.sort === sort;
          // Les sens, dans l'ordre où le bureau les propose : celui par défaut d'abord.
          const first = defaultDirection(sort);
          const directions = [first, ...DIRECTIONS.filter((d) => d !== first)];
          return (
            <View key={sort}>
              <Pressable
                onPress={() => pick(sort, selected ? prefs.direction : first)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
              >
                <Text style={[typography.body, styles.flex, { color: selected ? accent : theme.colors.text.primary }]}>{t(`listOrder.sort.${sort}`)}</Text>
                {selected ? <Check size={20} color={accent} /> : null}
              </Pressable>
              {selected && sort !== "custom" ? (
                <View style={styles.directions} accessibilityRole="radiogroup">
                  {directions.map((direction) => {
                    const on = prefs.direction === direction;
                    return (
                      <Pressable
                        key={direction}
                        onPress={() => pick(sort, direction)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[styles.chip, { backgroundColor: on ? colors.accentSoft : theme.colors.fill.subtle, borderColor: on ? accent : "transparent" }]}
                      >
                        <Text style={[typography.caption, { color: on ? accent : theme.colors.text.secondary }]}>{t(`listOrder.direction.${sort}.${direction}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 8, paddingBottom: 32 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderRadius: 12 },
  flex: { flex: 1 },
  directions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: "center" },
});
