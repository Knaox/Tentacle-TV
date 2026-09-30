import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { Chip } from "../../controls/Chip";
import { colors, text } from "../../theme/tokens";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";
import { RESULTS_CLIP, type SearchDiscoverModel } from "./searchViewModel";

/**
 * Ce que montre la recherche quand elle n'a pas de résultats à montrer — et
 * qui n'est jamais une impasse : une phrase qui dit ce que le moteur comprend
 * (un titre, un acteur, un genre, une faute de frappe), les recherches
 * récentes (un appui les relance) et les genres de la bibliothèque à
 * parcourir, avec ce qu'ils couvrent. `empty` : la saisie n'a rien trouvé, la
 * même page le dit en tête. Clés : `recent:0`…, `genre:0`…
 */
export const SearchDiscover = memo(function SearchDiscover({
  discover,
  empty,
  onPickRecent,
  onPickGenre,
}: {
  discover: SearchDiscoverModel;
  empty: boolean;
  onPickRecent?: (query: string) => void;
  onPickGenre?: (name: string) => void;
}) {
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onLayout={onViewportLayout}
    >
      <View style={styles.head}>
        <Text style={[text.title, empty && styles.emptyTitle]} numberOfLines={2}>{discover.title}</Text>
        <Text style={[text.body, styles.hint]}>{discover.hint}</Text>
      </View>
      {discover.recents.length > 0 ? (
        <View style={styles.group} onLayout={sectionLayout("recent", ["recent"])}>
          <Text style={text.rowTitle}>{discover.recentsTitle}</Text>
          <View style={styles.chips}>
            {discover.recents.map((query, index) => (
              <Chip
                key={query}
                label={query}
                icon="history"
                focusKey={`recent:${index}`}
                onPress={onPickRecent ? () => onPickRecent(query) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
      {discover.genres.length > 0 ? (
        <View style={styles.group} onLayout={sectionLayout("genre", ["genre"])}>
          <Text style={text.rowTitle}>{discover.genresTitle}</Text>
          <View style={styles.chips}>
            {discover.genres.map((genre, index) => (
              <Chip
                key={genre.name}
                label={genre.name}
                detail={genre.detail}
                focusKey={`genre:${index}`}
                onPress={onPickGenre ? () => onPickGenre(genre.name) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: TV_STAGE.safe.y + 6, paddingLeft: RESULTS_CLIP, paddingRight: TV_STAGE.safe.x, paddingBottom: 160 },
  head: { gap: 14, marginBottom: 52, maxWidth: 1000 },
  emptyTitle: { fontSize: 48, lineHeight: 54 },
  hint: { color: colors.textSecondary, maxWidth: 900 },
  group: { marginBottom: 52 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: TV_STAGE.row.titleGap },
});
