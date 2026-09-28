/**
 * Ce qu'un titre gardé sur l'appareil CONTIENT, dit avec les mots d'un DTO
 * Jellyfin — pour que la fiche locale réutilise tels quels les composants de
 * la fiche en ligne (qualité, langues, informations, reprise, marqueurs).
 *
 * Le snapshot `item.json` décrit la SOURCE du serveur. C'est la vérité du
 * fichier pour la qualité d'origine ; pour une version allégée, c'est faux :
 * « 4K · Dolby Vision · Atmos » au-dessus d'un H.264 720p en AAC serait un
 * mensonge. Les flux sont donc réécrits d'après ce que le serveur a réellement
 * produit — palier, piste audio embarquée, sous-titres gardés (cf.
 * `routes/downloads.ts` du backend et `subtitleSideCars` des deux clients).
 *
 * La progression vient de la base locale — celle de CE compte —, jamais du
 * snapshot, photographié au moment du transfert. Favoris et Ma liste en sont
 * retirés : hors ligne on ne sait pas s'ils ont changé depuis, et la fiche
 * locale ne sait pas les basculer. Mieux vaut ne rien dire que dire faux.
 */

import type { MediaItem, MediaStream, UserItemData } from "@tentacle-tv/shared";
import type { DownloadListEntry } from "../core/listing";
import { LIGHT_PRESETS } from "../core/presets";
import { REMUX_PRESET } from "../variants/offlineVariants";
import { groupWatchState, type OfflineSeriesGroup } from "./offlineGroups";

/**
 * Codecs de sous-titres TEXTE — ceux que les deux clients gardent en side-cars
 * (même liste que `TEXT_SUB_CODECS` de `downloadTargets.ts` et `keepTargets.ts`).
 */
export const TEXT_SUBTITLE_CODECS: ReadonlySet<string> = new Set([
  "srt", "subrip", "ass", "ssa", "vtt", "webvtt", "sub", "text", "mov_text",
]);

/** Ce que la vue lit d'une entrée locale. */
export type LocalFileFacts = Pick<
  DownloadListEntry,
  | "itemId" | "title" | "kind" | "variant" | "preset" | "audioStreamIndex" | "burnSubtitleIndex"
  | "played" | "positionTicks" | "runtimeTicks" | "seriesId" | "seriesName" | "seasonId"
  | "indexNumber" | "parentIndexNumber" | "bytesDone"
>;

function isTextSubtitle(stream: MediaStream): boolean {
  return stream.Type === "Subtitle" && TEXT_SUBTITLE_CODECS.has((stream.Codec ?? "").toLowerCase());
}

/** Hauteur maximale d'un palier Allégé ; `null` pour la copie d'image (`pmax`) ou un palier inconnu. */
export function presetMaxHeight(preset: string | null): number | null {
  return LIGHT_PRESETS.find((candidate) => candidate.id === preset)?.maxHeight ?? null;
}

/** La piste qu'embarque une version allégée : celle demandée, sinon celle par défaut, sinon la première. */
function keptAudio(streams: readonly MediaStream[], index: number | null): MediaStream | undefined {
  const audios = streams.filter((stream) => stream.Type === "Audio");
  return (index !== null ? audios.find((stream) => stream.Index === index) : undefined)
    ?? audios.find((stream) => stream.IsDefault)
    ?? audios[0];
}

/**
 * La vidéo d'un palier Allégé : du H.264 en plage standard, sous le plafond
 * du palier. La largeur est ramenée au 16:9 du palier et jamais tirée de la
 * hauteur : un film en 2,39:1 réduit à 1080 lignes garde 2 592 colonnes, que
 * le classement par largeur prendrait pour de la 4K.
 */
function lightVideo(video: MediaStream, maxHeight: number | null): MediaStream {
  const height = maxHeight === null ? video.Height : Math.min(video.Height ?? maxHeight, maxHeight);
  const width = maxHeight === null ? video.Width : Math.min(video.Width ?? Infinity, Math.round((maxHeight * 16) / 9));
  return {
    Type: "Video",
    Index: video.Index,
    IsDefault: true,
    Codec: "h264",
    Language: video.Language,
    Width: Number.isFinite(width) ? width : undefined,
    Height: height,
    VideoRangeType: "SDR",
  };
}

/**
 * L'audio d'une version allégée : toujours de l'AAC (le Dolby n'y survit
 * jamais, cf. `pmax` côté serveur). Le nombre de canaux n'est affirmé que
 * pour la copie d'image, que le serveur plafonne explicitement à six ; sur un
 * palier réencodé on n'en sait rien, donc on ne dit rien.
 */
function lightAudio(audio: MediaStream, remux: boolean): MediaStream {
  return {
    Type: "Audio",
    Index: audio.Index,
    IsDefault: true,
    Codec: "aac",
    Language: audio.Language,
    Title: audio.Title,
    Channels: remux && audio.Channels ? Math.min(audio.Channels, 6) : undefined,
  };
}

/**
 * Les flux que le FICHIER local contient réellement.
 *
 * Qualité d'origine : la source telle quelle, moins les sous-titres image
 * EXTERNES (seuls les externes texte sont rapatriés, en side-cars). Allégé :
 * la vidéo du palier (ou l'image recopiée, palier `pmax`), UNE piste audio,
 * les sous-titres texte (tous gardés en side-cars) et celui qui a été incrusté.
 */
export function localStreams(
  streams: readonly MediaStream[],
  file: Pick<LocalFileFacts, "variant" | "preset" | "audioStreamIndex" | "burnSubtitleIndex">,
): MediaStream[] {
  if (file.variant === "original") {
    return streams.filter((stream) => !(stream.Type === "Subtitle" && stream.IsExternal && !isTextSubtitle(stream)));
  }
  const remux = file.preset === REMUX_PRESET;
  const out: MediaStream[] = [];
  const video = streams.find((stream) => stream.Type === "Video");
  if (video) out.push(remux ? video : lightVideo(video, presetMaxHeight(file.preset)));
  const audio = keptAudio(streams, file.audioStreamIndex);
  if (audio) out.push(lightAudio(audio, remux));
  for (const stream of streams) {
    if (stream.Type !== "Subtitle") continue;
    if (isTextSubtitle(stream) || stream.Index === file.burnSubtitleIndex) out.push(stream);
  }
  return out;
}

/** La progression locale de ce compte, dans la forme de `UserData`. */
export function localUserData(file: Pick<LocalFileFacts, "played" | "positionTicks" | "runtimeTicks">): UserItemData {
  const runtime = file.runtimeTicks ?? 0;
  const position = file.played ? 0 : file.positionTicks;
  return {
    PlaybackPositionTicks: position,
    PlayCount: file.played ? 1 : 0,
    IsFavorite: false,
    Played: file.played,
    PlayedPercentage: runtime > 0 && position > 0 ? Math.min(100, (position / runtime) * 100) : undefined,
  };
}

/**
 * Le DTO d'un titre gardé, tel que la fiche locale doit le montrer : le
 * snapshot quand il existe (sinon ce que la base connaît), avec les flux du
 * fichier et la progression locale.
 */
export function localMediaItem(snapshot: MediaItem | null | undefined, file: LocalFileFacts): MediaItem {
  const base: MediaItem = snapshot ?? {
    Id: file.itemId,
    Name: file.title ?? "",
    Type: file.kind === "episode" ? "Episode" : "Movie",
    SeriesId: file.seriesId ?? undefined,
    SeriesName: file.seriesName ?? undefined,
    SeasonId: file.seasonId ?? undefined,
    IndexNumber: file.indexNumber ?? undefined,
    ParentIndexNumber: file.parentIndexNumber ?? undefined,
  };
  const source = base.MediaSources?.[0];
  const runtimeTicks = base.RunTimeTicks ?? file.runtimeTicks ?? undefined;
  return {
    ...base,
    Name: base.Name || file.title || "",
    RunTimeTicks: runtimeTicks,
    UserData: localUserData({ ...file, runtimeTicks: runtimeTicks ?? null }),
    MediaSources: source
      ? [{
          ...source,
          Container: file.variant === "original" ? source.Container : "mp4",
          Size: file.bytesDone > 0 ? file.bytesDone : source.Size,
          MediaStreams: localStreams(source.MediaStreams ?? [], file),
        }]
      : undefined,
  };
}

/**
 * Le DTO d'une série gardée : `series.json` sous l'identité du groupe, sans
 * son nombre de saisons (celui du SERVEUR — la fiche locale dit le sien) et
 * « vue » quand tous ses épisodes gardés le sont, comme sa carte.
 */
export function localSeriesItem(seriesJson: MediaItem | null | undefined, group: OfflineSeriesGroup): MediaItem {
  const episodes = group.seasons.flatMap((season) => season.episodes);
  const { watched } = groupWatchState(episodes);
  return {
    ...(seriesJson ?? {}),
    Id: group.seriesId ?? group.key,
    Name: group.seriesName || seriesJson?.Name || "",
    Type: "Series",
    ChildCount: undefined,
    MediaSources: undefined,
    UserData: { PlaybackPositionTicks: 0, PlayCount: watched ? 1 : 0, IsFavorite: false, Played: watched },
  };
}

/** Octets gardés pour un ensemble d'entrées. */
export function keptBytes(entries: readonly Pick<DownloadListEntry, "bytesDone">[]): number {
  return entries.reduce((total, entry) => total + Math.max(0, entry.bytesDone), 0);
}

/**
 * La version d'un fichier, sous une forme que l'interface traduit : la
 * qualité d'origine, la copie d'image (`remux`), ou un palier allégé et sa
 * hauteur. Une série aux versions mêlées se dit `mixed`.
 */
export type LocalVersion =
  | { kind: "original" }
  | { kind: "remux" }
  | { kind: "light"; height: number | null }
  | { kind: "mixed" };

export function localVersionOf(file: Pick<LocalFileFacts, "variant" | "preset">): LocalVersion {
  if (file.variant === "original") return { kind: "original" };
  if (file.preset === REMUX_PRESET) return { kind: "remux" };
  return { kind: "light", height: presetMaxHeight(file.preset) };
}

export function localVersionOfGroup(files: readonly Pick<LocalFileFacts, "variant" | "preset">[]): LocalVersion | null {
  const first = files[0];
  if (first === undefined) return null;
  const same = files.every((file) => file.variant === first.variant && file.preset === first.preset);
  return same ? localVersionOf(first) : { kind: "mixed" };
}
