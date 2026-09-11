import { memo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { GenreFilter } from "@/components/catalog/GenreFilter";
import { StatusFilter } from "@/components/catalog/StatusFilter";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import type { CollectionFiltersApi } from "@/screens/collection/useCollectionFilters";

const TRIS = [
  { key: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { key: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { key: "sortYearDesc", sortBy: "ProductionYear", sortOrder: "Descending" },
  { key: "sortRatingDesc", sortBy: "CommunityRating", sortOrder: "Descending" },
] as const;

/**
 * La barre de filtres de Ma liste et de Mes favoris sur téléphone.
 *
 * Elle reprend les composants du catalogue — `GenreFilter`, `StatusFilter` —
 * plutôt que d'en refaire : ce sont les mêmes gestes, ils doivent avoir la même
 * tête. La recherche se révèle d'une icône, comme là-bas, pour ne pas manger
 * une ligne entière sur un écran étroit.
 */
export const CollectionFilterHeader = memo(function CollectionFilterHeader({
  filters,
}: {
  filters: CollectionFiltersApi;
}) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const [chercheOuverte, setChercheOuverte] = useState(false);

  return (
    <View style={st.bloc}>
      <View style={st.ligne}>
        {chercheOuverte ? (
          <View style={st.champ}>
            <Feather name="search" size={16} color={colors.text.tertiary} />
            <TextInput
              autoFocus
              value={filters.input}
              onChangeText={filters.setInput}
              placeholder={t("searchInLibrary", { name: "" }).trim()}
              placeholderTextColor={colors.text.tertiary}
              style={st.saisie}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => {
                filters.setInput("");
                setChercheOuverte(false);
              }}
              hitSlop={10}
              accessibilityLabel={t("clearSearch")}
            >
              <Feather name="x" size={16} color={colors.text.tertiary} />
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.onglets}>
              {filters.tabs.map((tab) => {
                const actif = filters.state.type === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => filters.patch({ type: tab.key })}
                    style={[st.puce, actif && st.puceActive]}
                  >
                    <Text style={[st.puceTexte, actif && st.puceTexteActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setChercheOuverte(true)} hitSlop={10} style={st.iconeRonde}>
              <Feather name="search" size={18} color={colors.text.secondary} />
            </Pressable>
          </>
        )}
      </View>

      <StatusFilter
        value={filters.state.statusFilter}
        onChange={(v) => filters.patch({ statusFilter: v })}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.onglets}>
        {TRIS.map((tri) => {
          const actif = filters.state.sortBy === tri.sortBy;
          return (
            <Pressable
              key={tri.key}
              onPress={() => filters.patch({ sortBy: tri.sortBy, sortOrder: tri.sortOrder })}
              style={[st.puce, actif && st.puceActive]}
            >
              <Text style={[st.puceTexte, actif && st.puceTexteActive]}>{t(tri.key)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Les genres viennent des titres chargés — aucune requête. */}
      {filters.genres.length > 0 && (
        <GenreFilter
          genres={filters.genres}
          selectedGenres={filters.state.genres}
          onGenresChange={(g) => filters.patch({ genres: g })}
        />
      )}

      <View style={st.pied}>
        <Text style={st.compte}>{t("resultCount", { count: filters.resultCount })}</Text>
        {filters.isFiltered && (
          <Pressable onPress={filters.reset} hitSlop={8}>
            <Text style={st.reinit}>{t("resetFilters")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    bloc: { gap: spacing.sm, paddingBottom: spacing.sm },
    ligne: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
    },
    onglets: { gap: spacing.xs, paddingHorizontal: spacing.screenPadding },
    puce: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.colors.fill.subtle,
    },
    puceActive: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.2, t.colors.fill.soft),
    },
    puceTexte: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    puceTexteActive: { color: t.colors.brand.light },
    iconeRonde: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
    },
    champ: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 38,
      borderRadius: 999,
      backgroundColor: t.colors.fill.subtle,
    },
    saisie: { flex: 1, ...typography.caption, fontFamily: FONT_FAMILY.regular, color: t.colors.text.primary },
    pied: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.screenPadding,
    },
    compte: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    reinit: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
  });
