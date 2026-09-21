import type { MediaSource, MediaStream as JfStream } from "@tentacle-tv/shared";
import type { MpvTrack } from "../../../modules/mpv-player";
import type { EngineAudioTrack, ExternalSubtitleSource } from "./types";

/**
 * La correspondance des pistes entre Jellyfin et les moteurs — pure, testée.
 *
 * Jellyfin numérote les flux comme ffprobe (`MediaStream.Index`) ; mpv expose
 * ce même numéro en `ff-index` pour les pistes du fichier. Un sous-titre
 * externe ajouté par `sub-add` se reconnaît à `externalFilename`, l'URL ou le
 * chemin exact passé à l'ajout. Le lecteur natif, lui, ne connaît que la
 * POSITION de la piste audio parmi les pistes audio.
 */

/** Position d'une piste audio Jellyfin parmi les pistes audio (-1 : inconnue). */
export function nativeAudioPosition(streams: readonly JfStream[], jellyfinIndex: number): number {
  return streams.filter((s) => s.Type === "Audio").findIndex((s) => s.Index === jellyfinIndex);
}

/** Les pistes que Jellyfin propose au départ, ou les défauts du fichier. */
export function defaultTrackIndices(
  source: Pick<MediaSource, "DefaultAudioStreamIndex" | "DefaultSubtitleStreamIndex" | "MediaStreams">,
): { audio: number; subtitle: number } {
  const streams = source.MediaStreams ?? [];
  const audios = streams.filter((s) => s.Type === "Audio");
  const audio =
    source.DefaultAudioStreamIndex ?? audios.find((s) => s.IsDefault)?.Index ?? audios[0]?.Index ?? -1;
  const subtitle = source.DefaultSubtitleStreamIndex ?? -1;
  return { audio, subtitle };
}

/** Le format servi tel quel par `/Subtitles/{index}/Stream.{format}` : jamais de conversion d'un ASS. */
export function externalSubtitleFormat(codec: string | undefined): ExternalSubtitleSource["format"] {
  switch ((codec ?? "").toLowerCase()) {
    case "ass":
    case "ssa":
      return "ass";
    case "vtt":
    case "webvtt":
      return "vtt";
    default:
      return "srt";
  }
}

/** Même fichier, écrit en URL `file://` d'un côté et en chemin de l'autre ? */
export function sameSubtitleFile(externalFilename: string, url: string): boolean {
  const strip = (value: string): string => {
    const bare = value.startsWith("file://") ? value.slice("file://".length) : value;
    try {
      return decodeURIComponent(bare);
    } catch {
      return bare;
    }
  };
  return strip(externalFilename) === strip(url);
}

/** L'identifiant mpv de la piste audio du fichier portant cet index Jellyfin. */
export function mpvAudioId(tracks: readonly MpvTrack[], jellyfinIndex: number): number | null {
  const track = tracks.find((t) => t.type === "audio" && !t.external && t.ffIndex === jellyfinIndex);
  return track ? track.id : null;
}

/**
 * L'identifiant mpv du sous-titre portant cet index Jellyfin : une piste du
 * fichier par `ffIndex`, un externe par son fichier. `null` si mpv ne l'a pas
 * (encore) : l'appelant l'ajoute alors par `sub-add`.
 */
export function mpvSubtitleId(
  tracks: readonly MpvTrack[],
  jellyfinIndex: number,
  externals: readonly ExternalSubtitleSource[],
): number | null {
  const external = externals.find((e) => e.jellyfinIndex === jellyfinIndex);
  if (external) {
    const track = tracks.find(
      (t) => t.type === "sub" && t.external && t.externalFilename !== undefined
        && sameSubtitleFile(t.externalFilename, external.url),
    );
    return track ? track.id : null;
  }
  const track = tracks.find((t) => t.type === "sub" && !t.external && t.ffIndex === jellyfinIndex);
  return track ? track.id : null;
}

/** Les pistes audio de mpv sous la forme que la façade annonce (`onLoad`). */
export function engineAudioTracks(tracks: readonly MpvTrack[]): EngineAudioTrack[] {
  return tracks
    .filter((t) => t.type === "audio")
    .map((t) => ({ index: t.ffIndex ?? t.id, title: t.title, language: t.lang, selected: t.selected }));
}
