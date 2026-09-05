import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLikedPeople, useLikePerson, usePersonSearch, usePersonSuggestions, useUnlikePerson,
} from "@tentacle-tv/api-client";
import type { LikedPerson, PersonSearchResult } from "@tentacle-tv/api-client";
import { RowHeader } from "@/components/RowHeader";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PersonBubble } from "./PersonBubble";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * « Vos acteurs », au pied de la page Pour vous : les personnes aimées
 * (portraits cerclés de marque, retrait à la croix), des acteurs connus en
 * suggestion pour amorcer, et une recherche débouncée. Chaque like/retrait
 * régénère le pool côté serveur — les rangées « Avec {acteur} » suivent.
 */
export function LikedActorsPanel() {
  const { t } = useTranslation("reco");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { data: likedData } = useLikedPeople();
  const { data: suggestions } = usePersonSuggestions();
  const like = useLikePerson();
  const unlike = useUnlikePerson();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedCallback((value: string) => setQuery(value), SEARCH_DEBOUNCE_MS);
  const { data: search, isFetching } = usePersonSearch(query);

  const liked = useMemo(() => likedData?.people ?? [], [likedData]);
  const searching = query.trim().length >= 2;
  const shown = useMemo(() => {
    const likedIds = new Set(liked.map((p) => p.personId));
    const source = searching ? (search?.results ?? []) : (suggestions?.results ?? []);
    return source.filter((r) => !likedIds.has(r.personId));
  }, [liked, searching, search, suggestions]);

  const onChange = useCallback((value: string) => {
    setInput(value);
    debounced.call(value);
  }, [debounced]);
  const addPerson = useCallback((r: PersonSearchResult) => {
    like.mutate({ personId: r.personId, name: r.name, profilePath: r.profilePath });
    setInput("");
    setQuery("");
  }, [like]);

  const renderLiked = useCallback(({ item }: { item: LikedPerson }) => (
    <PersonBubble person={item} mode="liked" pending={unlike.isPending} onAction={() => unlike.mutate(item.personId)} />
  ), [unlike]);
  const renderShown = useCallback(({ item }: { item: PersonSearchResult }) => (
    <PersonBubble person={item} mode="suggestion" pending={like.isPending} onAction={() => addPerson(item)} />
  ), [like.isPending, addPerson]);

  return (
    <View style={st.root} accessibilityLabel={t("actorsTitle")}>
      <RowHeader title={t("actorsTitle")} />
      <Text style={st.hint}>{t("actorsHint")}</Text>
      <TextInput
        value={input}
        onChangeText={onChange}
        placeholder={t("actorsSearchPlaceholder")}
        placeholderTextColor={theme.colors.text.quaternary}
        accessibilityLabel={t("actorsSearchPlaceholder")}
        style={st.input}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="words"
        clearButtonMode="while-editing"
      />

      {liked.length > 0 && (
        <FlatList
          horizontal
          data={liked}
          keyExtractor={(p) => String(p.personId)}
          renderItem={renderLiked}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Text style={st.sectionLabel}>{searching ? t("actorsResults") : t("actorsSuggested")}</Text>
      {shown.length > 0 ? (
        <FlatList
          horizontal
          data={shown}
          keyExtractor={(p) => String(p.personId)}
          renderItem={renderShown}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <Text style={st.empty}>{searching && !isFetching ? t("actorsNoResult") : "…"}</Text>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: { marginTop: spacing.xxl, marginBottom: spacing.lg },
  hint: { ...typography.caption, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md, maxWidth: 560 },
  input: {
    marginHorizontal: spacing.screenPadding, height: 44, paddingHorizontal: 16,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: t.colors.border.subtle,
    backgroundColor: t.colors.fill.subtle, color: t.colors.text.primary,
    ...typography.body, maxWidth: 420,
  },
  list: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg, gap: spacing.md },
  sectionLabel: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.quaternary, letterSpacing: 0.8, textTransform: "uppercase" as const, paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg },
  empty: { ...typography.caption, color: t.colors.text.tertiary, paddingHorizontal: spacing.screenPadding, marginTop: spacing.md },
});
