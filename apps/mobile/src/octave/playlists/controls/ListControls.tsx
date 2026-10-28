/**
 * Octave mobile — la barre d'une liste de titres : chercher dans la liste (chaque mot dans le titre, un
 * artiste ou l'album, accents ignorés : la règle du bureau), « Trier : … » (la feuille des tris), les filtres
 * utiles à CETTE liste (jamais une puce qui ne garde rien), le compte « 12 titres sur 340 », et pourquoi le
 * glisser attend (recherche, filtre). Absente sans `music.listOrder` (l'appelant ne la monte pas).
 */

import { memo, useEffect, useState, useTransition } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ArrowDownUp, Search, X } from "lucide-react-native";
import type { ReorderBlock } from "@tentacle-tv/api-client";
import type { MusicListDirection, MusicListPrefs, MusicListSortKey } from "@tentacle-tv/shared/music";
import type { ListFilter } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { SortSheet } from "./SortSheet";

interface Props {
  gutter: number;
  query: string;
  onQuery: (query: string) => void;
  filter: ListFilter;
  filters: readonly ListFilter[];
  onFilter: (filter: ListFilter) => void;
  prefs: MusicListPrefs;
  sorts: readonly MusicListSortKey[];
  onSort: (sort: MusicListSortKey, direction: MusicListDirection) => void;
  shown: number;
  total: number;
  block: ReorderBlock | null;
}

export const ListControls = memo(function ListControls(props: Props) {
  const { gutter, query, onQuery, filter, filters, onFilter, prefs, sorts, onSort, shown, total, block } = props;
  const { t } = useTranslation("music");
  const theme = useTheme();
  const [sorting, setSorting] = useState(false);
  const [text, setText] = useState(query);
  const [, startTransition] = useTransition();
  // « Tout afficher » (la liste remise à zéro ailleurs) vide aussi le champ.
  useEffect(() => {
    if (query === "") setText("");
  }, [query]);
  // La frappe se voit tout de suite ; la liste se refiltre en transition (jamais une touche retenue).
  const type = (value: string) => {
    setText(value);
    startTransition(() => onQuery(value));
  };
  const clear = () => type("");
  const narrowed = shown !== total;
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <View style={[styles.search, { backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}>
        <Search size={17} color={theme.colors.text.tertiary} />
        <TextInput
          value={text}
          onChangeText={type}
          placeholder={t("listOrder.searchPlaceholder")}
          placeholderTextColor={theme.colors.text.quaternary}
          accessibilityLabel={t("listOrder.searchLabel")}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          style={[typography.body, styles.input, { color: theme.colors.text.primary }]}
        />
        {text ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("listOrder.clearSearch")} style={styles.clear}>
            <X size={16} color={theme.colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => setSorting(true)}
          accessibilityRole="button"
          accessibilityLabel={t("listOrder.sortButton", { sort: t(`listOrder.sort.${prefs.sort}`) })}
          style={[styles.chip, styles.sortChip, { backgroundColor: theme.colors.fill.subtle }]}
        >
          <ArrowDownUp size={15} color={theme.colors.text.primary} />
          <Text style={[typography.caption, { color: theme.colors.text.primary }]}>{t(`listOrder.sort.${prefs.sort}`)}</Text>
        </Pressable>
        {filters.length > 1
          ? filters.map((f) => {
              const on = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => onFilter(f)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.chip, { backgroundColor: on ? theme.colors.brand.soft : theme.colors.fill.subtle, borderColor: on ? theme.colors.brand.accentLight : "transparent" }]}
                >
                  <Text style={[typography.caption, { color: on ? theme.colors.brand.accentLight : theme.colors.text.secondary }]}>{t(`listOrder.filter.${f}`)}</Text>
                </Pressable>
              );
            })
          : null}
      </ScrollView>
      {narrowed || (block && block !== "loading") ? (
        <Text accessibilityLiveRegion="polite" style={[typography.small, { color: theme.colors.text.tertiary }]}>
          {[narrowed ? t("listOrder.count", { count: shown, total }) : null, block && block !== "loading" ? t(`listOrder.blocked.${block}`) : null].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      <SortSheet visible={sorting} onClose={() => setSorting(false)} prefs={prefs} sorts={sorts} onSort={onSort} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingTop: 8, paddingBottom: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 12, paddingRight: 6 },
  input: { flex: 1, minHeight: 44, paddingVertical: 0 },
  clear: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, alignItems: "center" },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "transparent", justifyContent: "center" },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 6 },
});
