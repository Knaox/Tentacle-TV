/**
 * Octave — un `BaseItemDto` de Jellyfin devient une ligne de l'index. Pur.
 *
 * Relevés du banc (Jellyfin 10.11, 2026-10-24) : l'enregistrement MusicBrainz
 * est `ProviderIds.MusicBrainzRecording` ; un DSF se dit `dsd_lsbf_planar`,
 * `SampleRate` 352800 et `BitDepth` 8 — des OCTETS par seconde : la vraie
 * fréquence est huit fois plus haute (DSD64 = 2 822 400 Hz), sur un bit.
 */

import type { MusicAudioFormat } from "../contract/musicTypes";
import { normalizeMbid } from "../contract/musicKeys";
import type { IndexArtist, IndexKind, IndexRow } from "../index/indexTypes";
import { normalizeId, type JfItem, type JfMediaSource, type JfNamedRef } from "./musicJellyfin";

const LOSSLESS = new Set(["flac", "alac", "wav", "aiff", "dsd", "ape", "wavpack", "tta", "pcm", "mlp", "truehd"]);

function codecName(raw: string, container: string | null): string {
  const codec = raw.toLowerCase();
  if (codec.startsWith("dsd_")) return "dsd";
  if (codec === "wv") return "wavpack";
  if (codec.startsWith("pcm_")) return container === "aiff" || container === "aif" ? "aiff" : "wav";
  if (codec === "vorbis") return "vorbis";
  return codec;
}

/** Le format VRAI du fichier, tel que Jellyfin l'a sondé ; `null` sans flux audio. */
export function formatOf(source: JfMediaSource | undefined): MusicAudioFormat | null {
  const stream = source?.MediaStreams?.find((s) => s.Type === "Audio");
  if (!stream?.Codec) return null;
  const container = source?.Container?.toLowerCase() ?? null;
  const codec = codecName(stream.Codec, container);
  const dsd = codec === "dsd";
  return {
    codec,
    container,
    sampleRate: stream.SampleRate ? (dsd ? stream.SampleRate * 8 : stream.SampleRate) : null,
    bitDepth: dsd ? 1 : (stream.BitDepth ?? null),
    bitrate: stream.BitRate ?? source?.Bitrate ?? null,
    channels: stream.Channels ?? null,
    lossless: LOSSLESS.has(codec),
  };
}

function mbidsOf(raw: string | undefined): (string | null)[] {
  if (!raw) return [];
  // Jellyfin joint parfois plusieurs identifiants par « / » (un par artiste du crédit).
  return raw.split("/").map((part) => normalizeMbid(part));
}

function artistRefs(refs: JfNamedRef[] | undefined, mbids: (string | null)[]): IndexArtist[] {
  return (refs ?? [])
    .filter((r) => r.Name)
    .map((r, i) => ({ id: r.Id ? normalizeId(r.Id) : null, name: r.Name!, mbid: mbids[i] ?? null }));
}

function ms(ticks: number | undefined): number | null {
  return typeof ticks === "number" && ticks > 0 ? Math.round(ticks / 10_000) : null;
}

function dateMs(value: string | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function imageOf(item: JfItem): string | null {
  const own = item.ImageTags?.Primary;
  if (own) return `${normalizeId(item.Id)}/${own}`;
  if (item.AlbumId && item.AlbumPrimaryImageTag) return `${normalizeId(item.AlbumId)}/${item.AlbumPrimaryImageTag}`;
  return null;
}

/**
 * L'enregistrement MusicBrainz : `MusicBrainzRecording` (10.9+), sinon
 * `MusicBrainzTrack`, où un Jellyfin d'avant le rangeait (relevé d'A5). Un
 * identifiant de piste de parution pris à tort ne correspond à aucun
 * enregistrement : il ne rapproche rien, il ne trompe rien.
 */
export function recordingOf(ids: Record<string, string | undefined>): string | null {
  return normalizeMbid(ids.MusicBrainzRecording) ?? normalizeMbid(ids.MusicBrainzTrack);
}

const KIND: Record<string, IndexKind> = { Audio: "track", MusicAlbum: "album", MusicArtist: "artist" };

/** `null` pour un élément qui n'est pas de la musique (dossier, playlist, vidéo). */
export function rowFromItem(item: JfItem): IndexRow | null {
  const kind = item.Type ? KIND[item.Type] : undefined;
  if (!kind || !item.Id) return null;
  const ids = item.ProviderIds ?? {};
  const name = item.Name ?? "";
  const artistMbids = mbidsOf(ids.MusicBrainzArtist);
  const source = item.MediaSources?.[0];
  const artists =
    kind === "artist"
      ? [{ id: normalizeId(item.Id), name, mbid: normalizeMbid(ids.MusicBrainzArtist) }]
      : artistRefs(item.ArtistItems?.length ? item.ArtistItems : item.AlbumArtists, kind === "album" ? mbidsOf(ids.MusicBrainzAlbumArtist) : artistMbids);
  return {
    id: normalizeId(item.Id),
    kind,
    name,
    sortName: (item.SortName ?? name).toLowerCase(),
    albumId: kind === "track" && item.AlbumId ? normalizeId(item.AlbumId) : null,
    albumName: kind === "track" ? (item.Album ?? null) : kind === "album" ? name : null,
    albumArtist: kind === "artist" ? null : (item.AlbumArtist ?? item.AlbumArtists?.[0]?.Name ?? null),
    artists,
    year: item.ProductionYear ?? null,
    trackNumber: kind === "track" ? (item.IndexNumber ?? null) : null,
    discNumber: kind === "track" ? (item.ParentIndexNumber ?? null) : null,
    durationMs: ms(item.RunTimeTicks),
    recordingMbid: kind === "track" ? recordingOf(ids) : null,
    releaseMbid: kind === "artist" ? null : normalizeMbid(ids.MusicBrainzAlbum),
    releaseGroupMbid: kind === "artist" ? null : normalizeMbid(ids.MusicBrainzReleaseGroup),
    artistMbid: kind === "artist" ? normalizeMbid(ids.MusicBrainzArtist) : (artistMbids[0] ?? null),
    format: kind === "track" ? formatOf(source) : null,
    sizeBytes: kind === "track" && typeof source?.Size === "number" ? source.Size : null,
    normalizationGain: typeof item.NormalizationGain === "number" ? item.NormalizationGain : null,
    imageTag: imageOf(item),
    childCount: kind === "album" ? (item.ChildCount ?? null) : null,
    dateCreated: dateMs(item.DateCreated),
  };
}
