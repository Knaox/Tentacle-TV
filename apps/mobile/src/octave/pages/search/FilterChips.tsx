/**
 * Octave mobile — les puces Tout · Titres · Albums · Artistes · Playlists d'une
 * recherche validée (rangée qui défile si l'écran est étroit). La puce choisie
 * prend le rose d'Octave ; une puce remplace l'adresse, sans entrée
 * d'historique. La puce est celle de tout le mode (`OctaveChip`).
 */

import { memo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { SearchFilter } from "@tentacle-tv/shared/octave";
import { OctaveChip } from "../../layout/OctaveChip";

const FILTERS: { value: SearchFilter; key: string }[] = [
  { value: "all", key: "search.filterAll" },
  { value: "tracks", key: "search.tracks" },
  { value: "albums", key: "search.albums" },
  { value: "artists", key: "search.artists" },
  { value: "playlists", key: "search.playlists" },
];

export const FilterChips = memo(function FilterChips({ value, onChange, gutter }: { value: SearchFilter; onChange: (f: SearchFilter) => void; gutter: number }) {
  const { t } = useTranslation("music");
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]} accessibilityRole="tablist" accessibilityLabel={t("search.filters")}>
      {FILTERS.map((f) => (
        <OctaveChip key={f.value} role="tab" label={t(f.key)} selected={f.value === value} onPress={() => onChange(f.value)} />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { gap: 8, alignItems: "center", paddingVertical: 4 },
});
