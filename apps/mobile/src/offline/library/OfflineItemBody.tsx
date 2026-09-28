import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { localVersionOf } from "@tentacle-tv/offline-core";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "@/components/CastRow";
import { DetailFacts } from "@/components/detail/DetailFacts";
import { Badge } from "@/components/ui";
import type { OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, CONTENT_MAX_WIDTH, useThemedStyles } from "@/theme";
import { OfflineAutoDeleteBlock } from "./OfflineAutoDeleteBlock";
import { OfflineDeviceCard, type DeviceFact } from "./OfflineDeviceCard";
import { OfflineEpisodeRow } from "./OfflineEpisodeRow";
import { OfflineOverview } from "./OfflineOverview";
import { addedOnText, versionText } from "./localText";

interface Props {
  entry: OfflineEntry;
  item: MediaItem;
  people: NonNullable<MediaItem["People"]>;
  genres: string[];
  siblings: OfflineEntry[];
  seasonName: string;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
  onToggleWatched: (entry: OfflineEntry, played: boolean) => void;
}

/**
 * Le corps de la fiche locale d'un titre — dans l'ordre de `DetailBody` :
 * genres, synopsis, pour un épisode les autres épisodes de sa saison présents
 * ici, la carte « Sur l'appareil » (version, place, arrivée, sous-titres,
 * suppression après visionnage), le casting (initiales — et sans lien hors
 * ligne, où la page d'une personne ne s'ouvrirait pas), puis « Informations »,
 * lues dans le FICHIER : ses langues, ses sous-titres.
 */
export function OfflineItemBody({ entry, item, people, genres, siblings, seasonName, onPlay, onMore, onToggleWatched }: Props) {
  const { t, i18n } = useTranslation(["offline", "downloads"]);
  const st = useThemedStyles(makeMediaDetailStyles);
  const offline = useOfflineMode();
  const overview = (item.Overview ?? "").replace(/<[^>]+>/g, "").trim();
  const summary = [versionText(t, localVersionOf(entry)), formatBytes(entry.bytesDone)].filter(Boolean).join(" · ");
  const added = addedOnText(entry.createdAt, i18n.language || "fr");
  const facts: DeviceFact[] = [];
  if (added) facts.push({ key: "added", label: t("offline:detailAddedOn"), value: added });
  if (entry.subtitlesExpected > 0) {
    facts.push({
      key: "subs",
      label: t("offline:detailSubtitlesKept"),
      value: t("offline:detailSubtitlesKeptValue", { done: entry.subtitlesDone ?? 0, total: entry.subtitlesExpected }),
    });
  }

  return (
    <View>
      {genres.length > 0 && (
        <View style={[st.genreRow, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {genres.slice(0, 6).map((genre) => <Badge key={genre} label={genre} variant="muted" uppercase={false} />)}
        </View>
      )}
      <OfflineOverview text={overview} />

      {siblings.length > 1 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xl, paddingHorizontal: spacing.screenPadding }}>
            <Text style={[st.sectionTitle, { marginTop: 0, paddingHorizontal: 0 }]}>{t("offline:alsoOnDevice")}</Text>
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

      <OfflineDeviceCard summary={summary} facts={facts}>
        <OfflineAutoDeleteBlock entry={entry} />
      </OfflineDeviceCard>

      {people.length > 0 && <CastRow people={people} readOnly={offline} />}
      <DetailFacts item={item} />
    </View>
  );
}
