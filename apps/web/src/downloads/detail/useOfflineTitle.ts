import { useMemo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { byEpisodeNumber, localMediaItem, seasonKeyOf, seriesKeyOf } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { useDownloadsRootReady } from "../localFiles";
import { useDownloadsListState } from "../useDownloadState";
import { useFirstLocalImage } from "./useFirstLocalImage";
import { useLocalJson } from "./useLocalJson";

type People = NonNullable<MediaItem["People"]>;

const NO_ENTRIES: DownloadEntry[] = [];
const NO_PEOPLE: People = [];
/** Un épisode sans décor de série prête sa propre image, 16:9 elle aussi. */
const EPISODE_BACKDROP = ["backdrop.jpg", "primary.jpg"] as const;
const MOVIE_BACKDROP = ["backdrop.jpg"] as const;
const OWN_PRIMARY = ["primary.jpg"] as const;
const LOGO = ["logo.png"] as const;

export interface OfflineTitle {
  /** Tout est lu — base, snapshot, sondes d'images : une absence est alors réelle. */
  ready: boolean;
  entry: DownloadEntry | null;
  /** Le DTO du FICHIER : snapshot, flux locaux, progression locale (`localMediaItem`). */
  item: MediaItem | null;
  /** Le casting sans photo — rien ne part sur le réseau ; celui de la série pour un épisode qui n'en porte pas. */
  people: People;
  /** Les épisodes de la même saison gardés ici, celui-ci compris, dans l'ordre. */
  siblings: DownloadEntry[];
  seriesKey: string | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  logoUrl: string | null;
}

/**
 * La matière de la fiche d'un film ou d'un épisode gardé sur cette machine.
 * Tout vient de la base locale et du disque : elle se lit à l'identique en
 * ligne et hors ligne, sans une requête vers le serveur.
 */
export function useOfflineTitle(itemId: string | undefined): OfflineTitle {
  const { entries, ready: listReady } = useDownloadsListState();
  const rootReady = useDownloadsRootReady();
  const entry = useMemo(
    () => entries.find((candidate) => candidate.itemId === itemId && candidate.status === "complete") ?? null,
    [entries, itemId],
  );
  const ownId = entry ? entry.itemId : undefined;
  const isEpisode = entry?.kind === "episode";

  const snapshot = useLocalJson<MediaItem>(ownId, "item.json");
  const seriesJson = useLocalJson<MediaItem>(isEpisode ? ownId : undefined, "series.json");
  const backdrop = useFirstLocalImage(ownId, isEpisode ? EPISODE_BACKDROP : MOVIE_BACKDROP);
  const poster = useFirstLocalImage(ownId, OWN_PRIMARY);
  const logo = useFirstLocalImage(isEpisode ? undefined : ownId, LOGO);

  const item = useMemo(() => (entry ? localMediaItem(snapshot.data, entry) : null), [entry, snapshot.data]);
  const people = useMemo<People>(() => {
    const own = snapshot.data?.People ?? NO_PEOPLE;
    const source = own.length > 0 ? own : (seriesJson.data?.People ?? NO_PEOPLE);
    return source.map((person) => ({ ...person, PrimaryImageTag: undefined }));
  }, [snapshot.data?.People, seriesJson.data?.People]);
  const siblings = useMemo(() => {
    if (!entry || entry.kind !== "episode") return NO_ENTRIES;
    const key = seasonKeyOf(entry);
    return entries
      .filter((candidate) => candidate.status === "complete" && candidate.kind === "episode" && seasonKeyOf(candidate) === key)
      .sort(byEpisodeNumber);
  }, [entries, entry]);

  // Sans base de ressources (serveur loopback indisponible), il n'y a rien à
  // attendre : la fiche se dessine sans images plutôt que de rester en suspens.
  const imagesSettled = !rootReady || (backdrop.settled && poster.settled && (isEpisode || logo.settled));
  const snapshotsSettled = !rootReady || (snapshot.settled && (!isEpisode || seriesJson.settled));

  return {
    ready: listReady && (entry === null || (imagesSettled && snapshotsSettled)),
    entry,
    item,
    people,
    siblings,
    seriesKey: entry && isEpisode ? seriesKeyOf(entry) : null,
    backdropUrl: backdrop.url,
    posterUrl: poster.url,
    logoUrl: logo.url,
  };
}
