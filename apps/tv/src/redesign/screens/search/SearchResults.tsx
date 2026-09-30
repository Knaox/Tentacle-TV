import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { CardModel } from "../../cards/cardTypes";
import { Chip } from "../../controls/Chip";
import { MediaRow } from "../../rows/MediaRow";
import { text } from "../../theme/tokens";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";
import { PeopleRow } from "./PeopleRow";
import { SearchNotice } from "./SearchNotice";
import { SearchTopHit } from "./SearchTopHit";
import {
  RESULTS_CLIP,
  RESULTS_WIDTH,
  type SearchFacetModel,
  type SearchNoticeModel,
  type SearchPersonModel,
  type SearchSectionModel,
} from "./searchViewModel";

/**
 * Les résultats, en rangées, dans l'ordre de `tvSearchSections` : la
 * bannière du meilleur résultat, puis la catégorie de ce résultat, puis les
 * autres (films, séries, collections en affiches ; personnes en portraits ;
 * épisodes en 16:9 ; genres et studios en pastilles). Une réponse périmée —
 * celle d'une frappe précédente — reste lisible, atténuée.
 */

export interface SearchResultsProps {
  notice: SearchNoticeModel | null;
  stale: boolean;
  sections: SearchSectionModel[];
  onOpenTop?: () => void;
  onFocusTop?: (focused: boolean) => void;
  onPressCard?: (sectionKey: string, card: CardModel) => void;
  onLongPressCard?: (sectionKey: string, card: CardModel) => void;
  onFocusCard?: (sectionKey: string, card: CardModel) => void;
  onOpenPerson?: (person: SearchPersonModel) => void;
  onOpenFacet?: (facet: SearchFacetModel) => void;
}

const STALE_OPACITY = 0.45;

export const SearchResults = memo(function SearchResults({
  notice,
  stale,
  sections,
  onOpenTop,
  onFocusTop,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onOpenPerson,
  onOpenFacet,
}: SearchResultsProps) {
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const dim = stale ? styles.stale : null;
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onLayout={onViewportLayout}
    >
      {notice ? (
        <View style={[styles.notice, dim]}>
          <SearchNotice notice={notice} />
        </View>
      ) : null}
      {sections.map((section) => {
        const layout = sectionLayout(section.key, [section.key]);
        switch (section.key) {
          case "top":
            return (
              <View key="top" style={[styles.top, dim]} onLayout={layout}>
                <SearchTopHit
                  top={section.top}
                  label={section.label}
                  width={RESULTS_WIDTH}
                  tall={sections.length === 1}
                  onPress={onOpenTop}
                  onFocusChange={onFocusTop}
                />
              </View>
            );
          case "people":
            return (
              <View key="people" style={dim} onLayout={layout}>
                <PeopleRow title={section.title} people={section.people} inset={RESULTS_CLIP} onOpen={onOpenPerson} />
              </View>
            );
          case "facets":
            return (
              <View key="facets" style={[styles.facets, dim]} onLayout={layout}>
                <Text style={text.rowTitle} numberOfLines={1}>{section.title}</Text>
                <View style={styles.chips}>
                  {section.facets.map((facet, index) => (
                    <Chip
                      key={`${facet.kind}:${facet.name}`}
                      label={facet.name}
                      detail={facet.detail}
                      focusKey={`facets:${index}`}
                      onPress={onOpenFacet ? () => onOpenFacet(facet) : undefined}
                    />
                  ))}
                </View>
              </View>
            );
          default:
            return (
              <View key={section.key} style={dim} onLayout={layout}>
                <MediaRow
                  rowKey={section.key}
                  title={section.title}
                  cards={section.cards}
                  variant={section.key === "episodes" ? "landscape" : "poster"}
                  cardWidth={section.key === "episodes" ? 340 : undefined}
                  inset={RESULTS_CLIP}
                  accessory={section.count ? <Text style={styles.count}>{section.count}</Text> : undefined}
                  onPressCard={onPressCard ? (card) => onPressCard(section.key, card) : undefined}
                  onLongPressCard={onLongPressCard ? (card) => onLongPressCard(section.key, card) : undefined}
                  onFocusCard={onFocusCard ? (card) => onFocusCard(section.key, card) : undefined}
                />
              </View>
            );
        }
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: TV_STAGE.safe.y, paddingBottom: 200 },
  stale: { opacity: STALE_OPACITY },
  notice: { paddingLeft: RESULTS_CLIP, marginBottom: 28 },
  top: { paddingLeft: RESULTS_CLIP, marginBottom: 56 },
  facets: { paddingLeft: RESULTS_CLIP, paddingRight: TV_STAGE.safe.x, marginBottom: TV_STAGE.row.spacing },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: TV_STAGE.row.titleGap },
  count: { ...text.caption, fontSize: 24 },
});
