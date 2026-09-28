import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { localVersionOf, seasonLabel } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { formatBytes } from "../presets";
import { CastRow } from "../../components/CastRow";
import { DetailFacts } from "../../components/detail/DetailFacts";
import { TechInfo } from "../../components/TechInfo";
import { OfflineAutoDeleteField } from "./OfflineAutoDeleteField";
import { OfflineDevicePanel, RemoveFromDeviceButton, type DeviceFact } from "./OfflineDevicePanel";
import { OfflineEpisodesSection } from "./OfflineEpisodesSection";
import { RevealOnView } from "./RevealOnView";
import { addedOnLabel, versionLabel } from "./offlineDetailText";

interface Props {
  entry: DownloadEntry;
  item: MediaItem;
  people: NonNullable<MediaItem["People"]>;
  siblings: readonly DownloadEntry[];
  onRemove: () => void;
}

/**
 * Sous la scène d'un titre gardé, dans l'ordre de lecture de la fiche en
 * ligne : les autres épisodes de sa saison présents ici (épisode), la carte
 * « Sur cet appareil », le casting et l'équipe (initiales — rien ne part sur
 * le réseau, ni lien vers une filmographie qu'on ne pourrait pas ouvrir), puis
 * « Informations » — langues et sous-titres du FICHIER.
 *
 * Les infos techniques ne valent que pour la qualité d'origine : sur une
 * version allégée, les débits et profils de la source ne décrivent plus rien.
 */
export function OfflineTitleSections({ entry, item, people, siblings, onRemove }: Props) {
  const { t, i18n } = useTranslation(["downloads", "common"]);
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];
  const added = addedOnLabel(entry.createdAt, i18n.language || "fr");

  const facts: DeviceFact[] = [
    { key: "version", label: t("downloads:detailVersion"), value: versionLabel(t, localVersionOf(entry)) },
    { key: "size", label: t("downloads:detailSize"), value: formatBytes(entry.bytesDone) },
  ];
  if (added) facts.push({ key: "added", label: t("downloads:detailAddedOn"), value: added });
  if (entry.subtitlesExpected > 0) {
    facts.push({
      key: "subs",
      label: t("downloads:detailSubtitlesKept"),
      value: t("downloads:detailSubtitlesKeptValue", { done: entry.subtitlesDone ?? 0, total: entry.subtitlesExpected }),
    });
  }

  return (
    <div className="relative z-10 mt-6 space-y-12 pb-16">
      {entry.kind === "episode" && siblings.length > 1 && (
        <RevealOnView>
          <OfflineEpisodesSection
            title={`${t("downloads:detailAlsoOnDevice")} · ${seasonLabel(t, entry.parentIndexNumber)}`}
            episodes={siblings}
            currentId={entry.itemId}
          />
        </RevealOnView>
      )}

      <RevealOnView>
        <OfflineDevicePanel facts={facts}>
          <OfflineAutoDeleteField entry={entry} />
          <RemoveFromDeviceButton label={t("downloads:detailRemove")} onClick={onRemove} />
        </OfflineDevicePanel>
      </RevealOnView>

      {people.length > 0 && (
        <RevealOnView>
          <CastRow people={people} readOnly />
        </RevealOnView>
      )}

      <RevealOnView>
        <DetailFacts item={item} links={false} />
        {entry.variant === "original" && streams.length > 0 && (
          <div className="row-gutter">
            <TechInfo streams={streams} />
          </div>
        )}
      </RevealOnView>
    </div>
  );
}
