import { memo, useCallback, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem, SearchItemHit, SearchMediaItem, SearchPersonHit, SearchTopHit } from "@tentacle-tv/shared";
import type { TvSearchFacet, TvSearchNotice, TvSearchSection } from "@tentacle-tv/tv-core";
import { FocusableRow } from "../focus/FocusableRow";
import { Focusable } from "../focus/Focusable";
import { TVPosterCard } from "../cards/TVPosterCard";
import { TVEpisodeCard } from "../cards/TVEpisodeCard";
import { TV_EPISODE_WIDTH, TV_POSTER_WIDTH } from "../cards/cardSizes";
import { TVPersonCard, PERSON_CARD_WIDTH } from "./TVPersonCard";
import { TVSearchChip } from "./TVSearchChip";
import { TVSearchTopHit } from "./TVSearchTopHit";
import { Colors, Spacing, Typography } from "../../theme/colors";

export interface TVSearchResultsActions {
  onOpenItem: (itemId: string) => void;
  onOpenTop: (top: SearchTopHit) => void;
  onOpenPerson: (person: SearchPersonHit) => void;
  onOpenFacet: (facet: TvSearchFacet) => void;
}

/** Les cartes lisent un `MediaItem` : un résultat du moteur en est un
 *  sous-ensemble (mêmes champs Jellyfin, tronqués à ce qu'une carte montre). */
const asMediaItem = (item: SearchMediaItem) => item as unknown as MediaItem;
const hitKey = (hit: SearchItemHit) => hit.item.Id;
const personKey = (person: SearchPersonHit) => person.id;
const episodeKey = (item: SearchMediaItem) => item.Id;

/**
 * Les résultats, en rangées : la bannière du meilleur résultat, puis une
 * rangée par catégorie dans l'ordre de `tvSearchSections` (tv-core, commun
 * avec la LG). La page défile d'elle-même vers la rangée qui prend le focus.
 *
 * `entryRef` reçoit le PREMIER résultat — la bannière, sinon la première carte
 * de la première rangée : c'est là que mène la validation de la saisie.
 */
export const TVSearchResults = memo(function TVSearchResults({ width, sections, notice, actions, entryRef }: {
  width: number;
  sections: TvSearchSection[];
  notice: TvSearchNotice;
  actions: TVSearchResultsActions;
  entryRef?: (node: View | null) => void;
}) {
  const { t } = useTranslation("search");
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef(new Map<string, number>());
  const scrollToSection = useCallback((key: string) => {
    const y = sectionY.current.get(key) ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }, []);
  const inner = width - Spacing.rowGutter * 2;

  const renderHit = useCallback(
    (hit: SearchItemHit, _i: number, focused: boolean) => (
      <TVPosterCard item={asMediaItem(hit.item)} width={TV_POSTER_WIDTH.md} focused={focused} />
    ),
    [],
  );
  const renderPerson = useCallback(
    (person: SearchPersonHit, _i: number, focused: boolean) => <TVPersonCard person={person} focused={focused} />,
    [],
  );
  const renderEpisode = useCallback(
    (item: SearchMediaItem, _i: number, focused: boolean) => (
      <TVEpisodeCard item={asMediaItem(item)} size="sm" focused={focused} />
    ),
    [],
  );
  const openHit = useCallback((hit: SearchItemHit) => actions.onOpenItem(hit.item.Id), [actions]);
  const openEpisode = useCallback((item: SearchMediaItem) => actions.onOpenItem(item.Id), [actions]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <NoticeLine notice={notice} />
      {sections.map((section, index) => {
        const onLayout = (e: { nativeEvent: { layout: { y: number } } }) => {
          sectionY.current.set(section.key, e.nativeEvent.layout.y);
        };
        const onRowFocus = () => scrollToSection(section.key);
        const entry = index === 0 ? entryRef : undefined;
        switch (section.key) {
          case "top":
            return (
              <View key="top" onLayout={onLayout} style={{ paddingHorizontal: Spacing.rowGutter, paddingTop: 16, paddingBottom: 8 }}>
                <TVSearchTopHit ref={entry} top={section.top} width={inner} onOpen={actions.onOpenTop} onFocus={onRowFocus} />
              </View>
            );
          case "movies":
          case "series":
          case "collections":
            return (
              <FocusableRow
                key={section.key}
                title={t(section.key)}
                titleAccessory={<Count total={section.total} />}
                data={section.hits}
                keyExtractor={hitKey}
                itemWidth={TV_POSTER_WIDTH.md}
                renderItem={renderHit}
                onItemPress={openHit}
                onRowFocus={onRowFocus}
                onLayout={onLayout}
                onFirstItem={entry}
              />
            );
          case "people":
            return (
              <FocusableRow
                key="people"
                title={t("people")}
                data={section.people}
                keyExtractor={personKey}
                itemWidth={PERSON_CARD_WIDTH}
                renderItem={renderPerson}
                onItemPress={actions.onOpenPerson}
                onRowFocus={onRowFocus}
                onLayout={onLayout}
                onFirstItem={entry}
              />
            );
          case "episodes":
            return (
              <FocusableRow
                key="episodes"
                title={t("episodes")}
                data={section.episodes}
                keyExtractor={episodeKey}
                itemWidth={TV_EPISODE_WIDTH.sm}
                renderItem={renderEpisode}
                onItemPress={openEpisode}
                onRowFocus={onRowFocus}
                onLayout={onLayout}
                onFirstItem={entry}
              />
            );
          case "facets":
            return (
              <View key="facets" onLayout={onLayout} style={{ paddingHorizontal: Spacing.rowGutter, paddingTop: 16 }}>
                <Text style={{ color: Colors.textPrimary, ...Typography.sectionTitle, marginBottom: 16 }}>{t("facets")}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {section.facets.map((facet, facetIndex) => (
                    <Focusable
                      key={`${facet.kind}:${facet.name}`}
                      ref={facetIndex === 0 ? entry : undefined}
                      variant="button"
                      focusRadius={999}
                      onPress={() => actions.onOpenFacet(facet)}
                      onFocus={onRowFocus}
                      accessibilityLabel={`${t(facet.kind)} ${facet.name}`}
                    >
                      <TVSearchChip label={facet.name} detail={t(facet.kind)} capitalize />
                    </Focusable>
                  ))}
                </View>
              </View>
            );
        }
      })}
    </ScrollView>
  );
});

function Count({ total }: { total: number }) {
  const { t } = useTranslation("search");
  return <Text style={{ color: Colors.textTertiary, ...Typography.meta }}>{t("countTitles", { count: total })}</Text>;
}

/** Une seule phrase au-dessus des rangées : correction, réponse partielle, index. */
function NoticeLine({ notice }: { notice: TvSearchNotice }) {
  const { t } = useTranslation("search");
  if (!notice) return null;
  const text = notice.kind === "correction"
    ? `${t("resultsFor")} « ${notice.correction} »`
    : notice.kind === "partial" ? t("partial") : t("indexing");
  return (
    <Text style={{
      color: notice.kind === "correction" ? Colors.accentPurpleLight : Colors.textTertiary,
      ...Typography.body, paddingHorizontal: Spacing.rowGutter, paddingTop: 12,
    }}>
      {text}
    </Text>
  );
}
