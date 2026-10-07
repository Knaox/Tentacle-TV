import { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import type { CardModel } from "../../cards/cardTypes";
import { Chip } from "../../controls/Chip";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { RENDER } from "../../render/renderProfile";
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
 *
 * Chaque rangée est une SECTION (`FocusSection`, clé `section:<rangée>`) :
 * HAUT / BAS passe à la voisine, au plus proche, et la rangée focalisée vient
 * entière dans la colonne, en un seul mouvement.
 */

const ROW_REVEAL: FocusSectionReveal = { mode: "nearest" };

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
              <FocusSection key="top" focusKey="section:top" reveal={ROW_REVEAL} style={[styles.top, dim]} onLayout={layout}>
                <SearchTopHit
                  top={section.top}
                  label={section.label}
                  width={RESULTS_WIDTH}
                  tall={sections.length === 1}
                  onPress={onOpenTop}
                  onFocusChange={onFocusTop}
                />
              </FocusSection>
            );
          case "people":
            return (
              <FocusSection key="people" focusKey="section:people" reveal={ROW_REVEAL} style={dim} onLayout={layout}>
                <PeopleRow title={section.title} people={section.people} inset={RESULTS_CLIP} onOpen={onOpenPerson} />
              </FocusSection>
            );
          case "facets":
            return (
              <FocusSection key="facets" focusKey="section:facets" reveal={ROW_REVEAL} style={[styles.facets, dim]} onLayout={layout}>
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
              </FocusSection>
            );
          default:
            return (
              <ResultRow
                key={section.key}
                sectionKey={section.key}
                title={section.title}
                cards={section.cards}
                count={section.count}
                stale={stale}
                onLayout={layout}
                onPressCard={onPressCard}
                onLongPressCard={onLongPressCard}
                onFocusCard={onFocusCard}
              />
            );
        }
      })}
    </ScrollView>
  );
});

type SectionHandler = (sectionKey: string, card: CardModel) => void;

/**
 * Une rangée de résultats, ses gestionnaires liés à SA section une fois pour
 * toutes : une frappe qui redessine les résultats ne redessine pas une rangée
 * dont les cartes n'ont pas changé, ni ses cartes.
 */
const ResultRow = memo(function ResultRow({
  sectionKey,
  title,
  cards,
  count,
  stale,
  onLayout,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  sectionKey: string;
  title: string;
  cards: CardModel[];
  count?: string;
  stale: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onPressCard?: SectionHandler;
  onLongPressCard?: SectionHandler;
  onFocusCard?: SectionHandler;
}) {
  const press = useMemo(() => (onPressCard ? (card: CardModel) => onPressCard(sectionKey, card) : undefined), [onPressCard, sectionKey]);
  const longPress = useMemo(() => (onLongPressCard ? (card: CardModel) => onLongPressCard(sectionKey, card) : undefined), [onLongPressCard, sectionKey]);
  const focus = useMemo(() => (onFocusCard ? (card: CardModel) => onFocusCard(sectionKey, card) : undefined), [onFocusCard, sectionKey]);
  const accessory = useMemo(() => (count ? <Text style={styles.count}>{count}</Text> : undefined), [count]);
  return (
    <FocusSection focusKey={`section:${sectionKey}`} reveal={ROW_REVEAL} style={stale ? styles.stale : null} onLayout={onLayout}>
      <MediaRow
        rowKey={sectionKey}
        title={title}
        cards={cards}
        variant={sectionKey === "episodes" ? "landscape" : "poster"}
        cardWidth={sectionKey === "episodes" ? 340 : undefined}
        inset={RESULTS_CLIP}
        recycleCards={RENDER.recycleResultCards}
        accessory={accessory}
        onPressCard={press}
        onLongPressCard={longPress}
        onFocusCard={focus}
      />
    </FocusSection>
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
