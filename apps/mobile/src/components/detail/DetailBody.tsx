import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, CONTENT_MAX_WIDTH } from "../../theme";
import { Badge } from "../ui";
import { MobileMediaCard } from "../MobileMediaCard";
import { MediaRow } from "../MediaRow";
import { MobileEpisodeList } from "../MobileEpisodeList";
import { CastRow } from "../CastRow";
import { LicenseAttribution } from "../LicenseAttribution";
import { MobileExtrasSection } from "./MobileExtrasSection";
import { st } from "../../screens/mediaDetailStyles";

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
 * Corps de la fiche détail (genres → synopsis → casting → extras → saisons/épisodes
 * → licence → similaires). Extrait de MediaDetailScreen (règle 300 lignes) ; partagé
 * entre le layout portrait (sous le hero) et paysage (colonne droite défilante).
 */
export function DetailBody({ item, isEpisode, parentSeries, similar, episodeListSeriesId, highlightEpisodeId, highlightSeasonId }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const [overviewTruncated, setOverviewTruncated] = useState(false);

  return (
    <View>
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
            onPlay={(ep) => router.push(`/watch/${ep.Id}`)}
          />
        </>
      )}

      <LicenseAttribution item={item} />
      {similar && similar.length > 0 && (
        <MediaRow title={t("recommendations")} data={similar}
          renderItem={(s: MediaItem) => <MobileMediaCard item={s} onPress={() => router.push(`/media/${s.Id}`)} />} />
      )}
    </View>
  );
}
