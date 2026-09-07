import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "@/components/CastRow";
import { Badge } from "@/components/ui";
import type { OfflineEntry } from "@/offline/engineApi";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "@/theme";
import { OfflineEpisodeRow } from "./OfflineEpisodeRow";
import { OfflineOnDeviceCard } from "./OfflineOnDeviceCard";
import { OfflineOverview } from "./OfflineOverview";

interface Props {
  entry: OfflineEntry;
  item: MediaItem | undefined;
  userId: string | null;
  people: NonNullable<MediaItem["People"]>;
  genres: string[];
  siblings: OfflineEntry[];
  seasonName: string;
  busy: boolean;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
  onToggleWatched: (entry: OfflineEntry, played: boolean) => void;
  onRemove: () => void;
}

/**
 * Le corps de la fiche locale d'un titre — le jumeau de `DetailBody` :
 * genres, synopsis, casting (initiales), la carte « Sur l'appareil », puis,
 * pour un épisode, les autres épisodes de sa saison présents sur l'appareil.
 */
export function OfflineItemBody({ entry, item, userId, people, genres, siblings, seasonName, busy, onPlay, onMore, onToggleWatched, onRemove }: Props) {
  const { t } = useTranslation("offline");
  const st = useThemedStyles(makeMediaDetailStyles);
  const overview = (item?.Overview ?? "").replace(/<[^>]+>/g, "").trim();
  return (
    <View>
      {genres.length > 0 && (
        <View style={[st.genreRow, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {genres.slice(0, 6).map((genre) => <Badge key={genre} label={genre} variant="muted" uppercase={false} />)}
        </View>
      )}
      <OfflineOverview text={overview} />
      {people.length > 0 && <CastRow people={people} />}
      <OfflineOnDeviceCard entry={entry} userId={userId} onToggleWatched={onToggleWatched} onRemove={onRemove} busy={busy} />

      {siblings.length > 1 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xl, paddingHorizontal: spacing.screenPadding }}>
            <Text style={[st.sectionTitle, { marginTop: 0, paddingHorizontal: 0 }]}>{t("alsoOnDevice")}</Text>
            <Badge label={seasonName} variant="muted" uppercase={false} />
          </View>
          <View style={{ paddingHorizontal: spacing.screenPadding, gap: 8, maxWidth: CONTENT_MAX_WIDTH, marginTop: spacing.sm }}>
            {siblings.map((sibling) => (
              <OfflineEpisodeRow
                key={sibling.itemId}
                entry={sibling}
                isCurrent={sibling.itemId === entry.itemId}
                onPlay={onPlay}
                onMore={onMore}
                onToggleWatched={onToggleWatched}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
