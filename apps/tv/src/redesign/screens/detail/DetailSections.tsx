import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { CardModel } from "../../cards/cardTypes";
import { FocusSection } from "../../focus/FocusSection";
import { MediaRow } from "../../rows/MediaRow";
import { colors, fonts } from "../../theme/tokens";
import { CastRow, CrewColumns } from "./CastRow";
import { DETAIL_LEFT, DetailSection } from "./DetailSection";
import { EpisodeRail } from "./EpisodeRail";
import { ExtrasRow } from "./ExtrasRow";
import { SagaRow } from "./SagaRow";
import { SeasonTabs } from "./SeasonTabs";
import type {
  CrewGroupModel,
  DetailCallbacks,
  DetailSectionKey,
  EpisodesModel,
  ExtraModel,
  PersonModel,
  SagaModel,
} from "./detailTypes";

/**
 * Ce que la fiche montre en descendant, dans l'ordre : le contenu d'une
 * collection, les saisons et leurs épisodes, le casting et l'équipe, les
 * extras, la saga, les titres similaires. Une section vide ne s'affiche pas.
 * Chaque ligne focalisable est une SECTION (`FocusSection`, clé `detail:*`) :
 * HAUT / BAS passe à la voisine, au plus proche ; la page s'ancre sur la
 * section qui la porte (`DetailSection`).
 */

export interface DetailSectionsProps extends DetailCallbacks {
  episodes?: EpisodesModel | null;
  collection?: CardModel[];
  cast?: PersonModel[];
  crew?: CrewGroupModel[];
  extras?: ExtraModel[];
  saga?: SagaModel | null;
  similar?: CardModel[];
  onSectionLayout: (key: DetailSectionKey, y: number, height: number) => void;
}

export const DetailSections = memo(function DetailSections({
  episodes,
  collection,
  cast,
  crew,
  extras,
  saga,
  similar,
  onSectionLayout,
  onSelectSeason,
  onFocusSeason,
  onPlayEpisode,
  onLongPressEpisode,
  onOpenPerson,
  onOpenExtra,
  onOpenSagaEntry,
  onLongPressSagaEntry,
  onOpenCard,
  onLongPressCard,
}: DetailSectionsProps) {
  const { t } = useTranslation();
  return (
    <>
      {collection?.length ? (
        <DetailSection sectionKey="collection" onLayout={onSectionLayout}>
          <FocusSection focusKey="detail:collection">
            <MediaRow
              rowKey="collection"
              title={t("common:collectionContent")}
              cards={collection}
              variant="poster"
              inset={DETAIL_LEFT}
              onPressCard={onOpenCard ? (card) => onOpenCard("collection", card) : undefined}
              onLongPressCard={onLongPressCard}
            />
          </FocusSection>
        </DetailSection>
      ) : null}
      {episodes ? (
        <DetailSection sectionKey="episodes" title={t("common:seasonsEpisodes")} onLayout={onSectionLayout}>
          {episodes.seasons.length > 1 ? (
            <SeasonTabs
              seasons={episodes.seasons}
              selectedId={episodes.selectedSeasonId}
              onSelect={onSelectSeason}
              onFocusSeason={onFocusSeason}
            />
          ) : null}
          <EpisodeRail
            key={episodes.selectedSeasonId}
            episodes={episodes.episodes}
            anchorIndex={episodes.anchorIndex}
            onPlay={onPlayEpisode}
            onLongPress={onLongPressEpisode}
          />
        </DetailSection>
      ) : null}
      {cast?.length || crew?.length ? (
        <DetailSection sectionKey="cast" title={t("media:castAndCrew")} onLayout={onSectionLayout}>
          {cast?.length ? <CastRow people={cast} onOpen={onOpenPerson} /> : null}
          {crew?.length ? <CrewColumns groups={crew} /> : null}
        </DetailSection>
      ) : null}
      {extras?.length ? (
        <DetailSection sectionKey="extras" title={t("common:extras")} onLayout={onSectionLayout}>
          <ExtrasRow extras={extras} onOpen={onOpenExtra} />
        </DetailSection>
      ) : null}
      {saga && saga.entries.length > 1 ? (
        <DetailSection
          sectionKey="saga"
          title={saga.title}
          accessory={<Text style={styles.summary} numberOfLines={1}>{saga.summary}</Text>}
          onLayout={onSectionLayout}
        >
          <SagaRow
            entries={saga.entries}
            onOpen={onOpenSagaEntry}
            onLongPress={onLongPressSagaEntry}
          />
        </DetailSection>
      ) : null}
      {similar?.length ? (
        <DetailSection sectionKey="similar" onLayout={onSectionLayout}>
          <FocusSection focusKey="detail:similar">
            <MediaRow
              rowKey="similar"
              title={t("common:similarTitles")}
              cards={similar}
              variant="poster"
              inset={DETAIL_LEFT}
              onPressCard={onOpenCard ? (card) => onOpenCard("similar", card) : undefined}
              onLongPressCard={onLongPressCard}
            />
          </FocusSection>
        </DetailSection>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  summary: { ...fonts.medium, fontSize: 24, color: colors.textTertiary, flexShrink: 1 },
});
