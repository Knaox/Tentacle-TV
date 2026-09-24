import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  highlightRanges, itemMeta, parseSearchQuery, personMeta,
  type ExternalSearchItem, type SearchPersonHit, type SearchProvider,
} from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PersonAvatar } from "./SearchPeople";
import { QuerySuggestions } from "./QuerySuggestions";
import type { SearchSuggestions } from "./useSearchSuggestions";

interface Props {
  query: string;
  suggestions: SearchSuggestions;
  /** Reprendre une requête complète (suggestion, correction). */
  onQuery: (query: string) => void;
  onOpenItem: (id: string) => void;
  onOpenPerson?: (person: SearchPersonHit) => void;
  onOpenExternal: (provider: SearchProvider, item: ExternalSearchItem) => void;
  /** « Tous les résultats » : la recherche complète, déjà remplie. */
  onSeeAll: () => void;
}

/**
 * Ce qu'une barre de recherche propose PENDANT la frappe, sous le champ — le
 * pendant mobile de l'omnibox du bureau : des requêtes complètes à reprendre,
 * les meilleurs résultats (l'affiche, ce qu'est le titre, la partie tapée en
 * évidence), les personnes, et ce que les extensions trouvent hors de la
 * bibliothèque (« via Vigie »). Un pied mène à tous les résultats.
 */
export const SearchSuggestPanel = memo(function SearchSuggestPanel({
  query, suggestions, onQuery, onOpenItem, onOpenPerson, onOpenExternal, onSeeAll,
}: Props) {
  const { t, i18n } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const terms = useMemo(() => parseSearchQuery(query).terms, [query]);
  const { queries, best, people, external } = suggestions;
  const nothing = queries.length === 0 && best.length === 0 && people.length === 0 && external.length === 0;

  return (
    <View style={st.card} accessibilityRole="menu">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        bounces={false}
        style={st.scroll}
      >
        <QuerySuggestions queries={queries} onPick={onQuery} layout="wrap" />

        {best.length > 0 && <Text style={st.heading}>{t("bestResults")}</Text>}
        {best.map((hit) => {
          const poster = hit.item.ImageTags?.Primary
            ? client.getImageUrl(hit.item.Id, "Primary", { height: 120, quality: 80 })
            : null;
          return (
            <Pressable
              key={hit.item.Id}
              onPress={() => onOpenItem(hit.item.Id)}
              accessibilityRole="menuitem"
              accessibilityLabel={`${hit.item.Name}, ${itemMeta(t, hit.item, i18n.language)}`}
              style={({ pressed }) => [st.row, pressed && st.pressed]}
            >
              <View style={st.thumb}>
                {poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />}
              </View>
              <View style={st.rowText}>
                <Highlighted text={hit.item.Name} terms={terms} />
                <Text style={st.meta} numberOfLines={1}>{itemMeta(t, hit.item, i18n.language)}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.text.quaternary} />
            </Pressable>
          );
        })}

        {onOpenPerson && people.map((person) => (
          <Pressable
            key={person.id}
            onPress={() => onOpenPerson(person)}
            accessibilityRole="menuitem"
            style={({ pressed }) => [st.row, pressed && st.pressed]}
          >
            <PersonAvatar person={person} size={40} />
            <View style={st.rowText}>
              <Highlighted text={person.name} terms={terms} />
              <Text style={st.meta} numberOfLines={1}>{personMeta(t, person)}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.text.quaternary} />
          </Pressable>
        ))}

        {external.map((result) => (
          <View key={result.provider.pluginId}>
            <Text style={st.heading}>
              {result.provider.label}
              <Text style={st.via}>{`  ·  ${t("externalBy", { name: result.provider.source })}`}</Text>
            </Text>
            {result.items.slice(0, 3).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onOpenExternal(result.provider, item)}
                accessibilityRole="menuitem"
                style={({ pressed }) => [st.row, pressed && st.pressed]}
              >
                <View style={[st.thumb, st.thumbOutside]}>
                  {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />}
                </View>
                <View style={st.rowText}>
                  <Highlighted text={item.title} terms={terms} />
                  <Text style={st.meta} numberOfLines={1}>
                    {[item.year, item.badge?.label].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Feather name="arrow-up-right" size={16} color={theme.colors.text.quaternary} />
              </Pressable>
            ))}
          </View>
        ))}

        {nothing && !suggestions.pending && (
          <Text style={st.none}>{t("noResults", { query: query.trim() })}</Text>
        )}

        <Pressable onPress={onSeeAll} accessibilityRole="button" style={({ pressed }) => [st.footer, pressed && st.pressed]}>
          <Feather name="search" size={15} color={theme.colors.brand.light} />
          <Text style={st.footerTxt} numberOfLines={1}>{t("allResults", { query: query.trim() })}</Text>
          <Feather name="arrow-right" size={15} color={theme.colors.brand.light} />
        </Pressable>
      </ScrollView>
    </View>
  );
});

/** Le titre, la partie tapée en évidence (débuts de mot seulement, comme le moteur). */
function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  const st = useThemedStyles(makeStyles);
  const ranges = highlightRanges(text, terms);
  if (ranges.length === 0) return <Text style={st.title} numberOfLines={1}>{text}</Text>;
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return (
    <Text style={st.title} numberOfLines={1}>
      {parts.map((part, i) => <Text key={i} style={part.hit ? st.hit : null}>{part.text}</Text>)}
    </Text>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexShrink: 1,
      marginHorizontal: spacing.screenPadding,
      marginBottom: spacing.sm,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      backgroundColor: t.colors.surface.s1,
      overflow: "hidden" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: t.isDark ? 0.4 : 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
    scroll: { flexGrow: 0 },
    heading: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 4,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
    },
    via: { textTransform: "none" as const, letterSpacing: 0, fontFamily: FONT_FAMILY.medium, color: t.colors.text.quaternary },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: 6 },
    pressed: { backgroundColor: t.colors.fill.subtle },
    thumb: { width: 36, height: 54, borderRadius: 6, overflow: "hidden" as const, backgroundColor: t.colors.surface.s3 },
    thumbOutside: { borderWidth: 1, borderColor: t.colors.border.subtle, borderStyle: "dashed" as const },
    rowText: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    hit: { fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    meta: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    none: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    footer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border.subtle,
      marginTop: 4,
    },
    footerTxt: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  });
