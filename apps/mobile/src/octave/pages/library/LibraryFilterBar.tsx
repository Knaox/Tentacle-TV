/**
 * Octave mobile — les FILTRES de la bibliothèque, à la Apple Music : une rangée
 * de puces (Albums · Artistes · Playlists, qui défile si l'écran est étroit), et,
 * sur les albums, « Trier » à droite du grand titre, qui ouvre la feuille des
 * tris — le tri en cours dit en mots sur le bouton. Sur la ligne des puces, il
 * coupait la dernière sur un écran de 402 pt. Les puces et le bouton sont ceux de tout le
 * mode (`OctaveChip`, `OctaveSortButton`). Cibles de 44 pt.
 */

import { memo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { LIBRARY_ALBUM_SORTS, LIBRARY_TABS, type LibraryAlbumSort, type LibraryTab } from "@tentacle-tv/shared/octave";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { OctaveChip, OctaveSortButton } from "../../layout/OctaveChip";
import { useOctaveColors } from "../../theme/octaveColors";

/** La rangée des puces (Albums · Artistes · Playlists), seule sur sa ligne : rien ne la coupe. */
export const LibraryFilterBar = memo(function LibraryFilterBar({ tab, onTab }: { tab: LibraryTab; onTab: (tab: LibraryTab) => void }) {
  const { t } = useTranslation("music");
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {LIBRARY_TABS.map((value) => (
        <OctaveChip key={value} role="tab" label={t(`library.${value}`)} selected={value === tab} onPress={() => onTab(value)} />
      ))}
    </ScrollView>
  );
});

/** « Trier » des albums, à droite du grand titre (à la Apple Music) : le tri en cours en mots, et sa feuille. */
export const LibrarySortControl = memo(function LibrarySortControl({ sort, onSort }: { sort: LibraryAlbumSort; onSort: (sort: LibraryAlbumSort) => void }) {
  const { t } = useTranslation("music");
  const [sorting, setSorting] = useState(false);
  const sortKey = LIBRARY_ALBUM_SORTS.find((s) => s.value === sort)?.key ?? "library.sortAdded";
  return (
    <>
      <OctaveSortButton label={t(sortKey)} accessibilityLabel={t("listOrder.sortButton", { sort: t(sortKey) })} onPress={() => setSorting(true)} />
      <LibrarySortSheet visible={sorting} onClose={() => setSorting(false)} value={sort} onChange={onSort} />
    </>
  );
});

/** « Trier par » des albums : un choix par tri, coché ; choisir ferme la feuille. */
function LibrarySortSheet({ visible, onClose, value, onChange }: { visible: boolean; onClose: () => void; value: LibraryAlbumSort; onChange: (s: LibraryAlbumSort) => void }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const colors = useOctaveColors();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[0.42, 0.6]}
      header={<Text style={[typography.subtitle, styles.title, { color: theme.colors.text.primary }]}>{t("listOrder.sortMenu")}</Text>}
    >
      <View style={styles.body} accessibilityRole="radiogroup">
        {LIBRARY_ALBUM_SORTS.map((s) => {
          const on = s.value === value;
          return (
            <Pressable
              key={s.value}
              onPress={() => {
                haptic("select");
                if (!on) onChange(s.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
            >
              <Text style={[typography.body, styles.flex, { color: on ? colors.accentText : theme.colors.text.primary }]}>{t(s.key)}</Text>
              {on ? <Check size={20} color={colors.accentText} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, alignItems: "center", paddingVertical: 4 },
  title: { paddingHorizontal: 20, paddingBottom: 8 },
  body: { paddingHorizontal: 8, paddingBottom: 32 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderRadius: 12 },
  flex: { flex: 1 },
});
