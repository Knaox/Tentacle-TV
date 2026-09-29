import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useCollectionItems } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "../../theme";
import { Badge } from "../ui";
import { MobileMediaCard } from "../MobileMediaCard";
import { MediaRow } from "../MediaRow";
import { MobileEpisodeList } from "../MobileEpisodeList";
import { useCardSheetOpener } from "@/components/cards/sheet/cardSheetContext";
import { landscapeSheetTarget } from "@/components/cards/sheet/cardSheetTarget";
import { EpisodeKeepOfflineButton } from "@/offline/entry/EpisodeKeepOfflineButton";
import { SeasonKeepOfflinePill } from "@/offline/entry/SeasonKeepOfflinePill";
import { CastRow } from "../CastRow";
import { LicenseAttribution } from "../LicenseAttribution";
import { MobileExtrasSection } from "./MobileExtrasSection";
import { DetailRating } from "./DetailRating";
import { DetailFacts } from "./DetailFacts";
import { SagaRow } from "./SagaRow";
import { IncludedInRow } from "./IncludedInRow";
import { makeMediaDetailStyles } from "../../screens/mediaDetailStyles";

interface Props {
  item: MediaItem;
  isEpisode: boolean;
  parentSeries?: MediaItem;
  similar?: MediaItem[];
  episodeListSeriesId?: string;
  highlightEpisodeId?: string;
  highlightSeasonId?: string;
}

/**
 * Corps de la fiche détail (genres → synopsis → contenu de la collection →
 * casting et équipe → extras → saisons/épisodes → informations → licence →
 * saga du film → similaires). Extrait de MediaDetailScreen (règle 300 lignes) ; partagé entre
 * le layout portrait (sous le hero) et paysage (colonne droite défilante).
 */
export function DetailBody({ item, isEpisode, parentSeries, similar, episodeListSeriesId, highlightEpisodeId, highlightSeasonId }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeMediaDetailStyles);
  const [expanded, setExpanded] = useState(false);
  const [overviewTruncated, setOverviewTruncated] = useState(false);
  const { data: collectionItems } = useCollectionItems(item.Type === "BoxSet" ? item.Id : undefined);
  // Les cartes des rangées (collection, similaires) ouvrent la feuille des
  // cartes d'elles-mêmes ; les lignes d'épisode la reçoivent, en variante 16:9.
  const openSheet = useCardSheetOpener();

  return (
    <View>
      {/* Votre note — sous les actions de l'en-tête, avant les genres. */}
      <DetailRating item={item} parentSeries={parentSeries} />

      {item.Genres && item.Genres.length > 0 && (
        <View style={[st.genreRow, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {item.Genres.slice(0, 6).map((g) => <Badge key={g} label={g} variant="muted" uppercase={false} />)}
        </View>
      )}

      {item.Overview && (
        <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg, maxWidth: CONTENT_MAX_WIDTH }}>
          <Text
            numberOfLines={expanded ? undefined : 4}
            style={st.overview}
            onTextLayout={(e) => {
              if (!expanded && e.nativeEvent.lines.length >= 4) setOverviewTruncated(true);
            }}
          >
            {item.Overview}
          </Text>
          {(overviewTruncated || expanded) && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={expanded ? t("showLess") : t("showMore")}
            >
              <Text style={st.expandLink}>{expanded ? t("showLess") : t("showMore")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Collection (BoxSet) : son contenu, navigable — sans lui, la fiche d'une
          collection n'avait ni lecture ni rien à ouvrir. */}
      {collectionItems && collectionItems.length > 0 && (
        <MediaRow title={t("collectionContent")} data={collectionItems}
          renderItem={(c: MediaItem) => <MobileMediaCard item={c} onPress={() => router.push(`/media/${c.Id}`)} />} />
      )}

      {item.People && item.People.length > 0 && <CastRow people={item.People} />}

      {/* Extras (au-dessus de Saisons & Épisodes) — épisode : extras série en repli. */}
      <MobileExtrasSection item={item} seriesItem={isEpisode ? parentSeries : undefined} />

      {/* Saisons & Épisodes — séries ET épisodes (parité desktop), épisode courant surligné. */}
      {episodeListSeriesId && (
        <>
          <Text style={st.sectionTitle}>{t("seasonsEpisodes")}</Text>
          <MobileEpisodeList
            seriesId={episodeListSeriesId}
            currentEpisodeId={highlightEpisodeId}
            initialSeasonId={highlightSeasonId}
            followResume={item.Type === "Series"}
            onPlay={(ep) => router.push(`/watch/${ep.Id}`)}
            seasonTrailing={(episodes) => <SeasonKeepOfflinePill episodes={episodes} />}
            rowLeading={(ep) => <EpisodeKeepOfflineButton episode={ep} />}
            onLongPressEpisode={openSheet ? (ep) => openSheet(landscapeSheetTarget(ep)) : undefined}
          />
        </>
      )}

      <DetailFacts item={item} />

      <LicenseAttribution item={item} />
      {/* La saga d'un film, comme au bureau : juste avant les similaires. */}
      {item.Type === "Movie" && <SagaRow item={item} />}
      <IncludedInRow itemId={item.Id} />
      {similar && similar.length > 0 && (
        <MediaRow title={t("recommendations")} data={similar}
          renderItem={(s: MediaItem) => <MobileMediaCard item={s} onPress={() => router.push(`/media/${s.Id}`)} />} />
      )}
    </View>
  );
}
