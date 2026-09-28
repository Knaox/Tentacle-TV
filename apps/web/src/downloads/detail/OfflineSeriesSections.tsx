import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { keptBytes, localVersionOfGroup, type OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { formatBytes } from "../presets";
import { CastRow } from "../../components/CastRow";
import { DetailFacts } from "../../components/detail/DetailFacts";
import { OfflineDevicePanel, RemoveFromDeviceButton, type DeviceFact } from "./OfflineDevicePanel";
import { OfflineEpisodesSection } from "./OfflineEpisodesSection";
import { RevealOnView } from "./RevealOnView";
import { addedOnLabel, versionLabel } from "./offlineDetailText";

interface Props {
  series: OfflineSeriesGroup;
  episodes: readonly DownloadEntry[];
  item: MediaItem;
  people: NonNullable<MediaItem["People"]>;
  /** L'épisode que vise « Lecture » : sa saison s'ouvre d'abord, et il est cerclé. */
  playTarget: DownloadEntry | null;
  onRemove: () => void;
}

/**
 * Sous la scène d'une série gardée : ses épisodes présents ici, saison par
 * saison (celle de l'épisode à reprendre d'abord), la carte « Sur cet
 * appareil » — version, place, nombre d'épisodes, dernier arrivé, retrait de
 * toute la série —, le casting sans photo, puis « Informations ».
 */
export function OfflineSeriesSections({ series, episodes, item, people, playTarget, onRemove }: Props) {
  const { t, i18n } = useTranslation(["downloads", "common"]);
  const [seasonChoice, setSeasonChoice] = useState<string | null>(null);
  const targetSeason = playTarget ? series.seasons.find((s) => s.episodes.some((e) => e.itemId === playTarget.itemId)) : undefined;
  // La saison choisie peut disparaître (dernier épisode retiré) : on retombe
  // sur celle de l'épisode à reprendre, puis sur la première.
  const season = series.seasons.find((s) => s.key === seasonChoice) ?? targetSeason ?? series.seasons[0];

  const newest = episodes.reduce<DownloadEntry | null>((best, e) => (best === null || e.createdAt > best.createdAt ? e : best), null);
  const added = newest ? addedOnLabel(newest.createdAt, i18n.language || "fr") : null;
  const facts: DeviceFact[] = [
    { key: "version", label: t("downloads:detailVersion"), value: versionLabel(t, localVersionOfGroup(episodes)) },
    { key: "size", label: t("downloads:detailSize"), value: formatBytes(keptBytes(episodes)) },
    {
      key: "episodes",
      label: t("downloads:detailEpisodes"),
      value: `${t("downloads:episodesCount", { count: episodes.length })} · ${t("downloads:seasonsCount", { count: series.seasons.length })}`,
    },
  ];
  if (added) facts.push({ key: "added", label: t("downloads:detailLastAdded"), value: added });

  return (
    <div className="relative z-10 mt-6 space-y-12 pb-16">
      {season && (
        <RevealOnView>
          <OfflineEpisodesSection
            title={t("downloads:detailEpisodesOnDevice")}
            episodes={season.episodes}
            currentId={playTarget?.itemId}
            seasons={{ all: series.seasons, activeKey: season.key, onSelect: setSeasonChoice }}
          />
        </RevealOnView>
      )}

      <RevealOnView>
        <OfflineDevicePanel
          facts={facts}
          action={<RemoveFromDeviceButton label={t("downloads:detailRemoveSeries")} onClick={onRemove} />}
        />
      </RevealOnView>

      {people.length > 0 && (
        <RevealOnView>
          <CastRow people={people} readOnly />
        </RevealOnView>
      )}

      <RevealOnView>
        <DetailFacts item={item} links={false} />
      </RevealOnView>
    </div>
  );
}
