/**
 * Les pistes d'un fichier LOCAL nommées comme en ligne.
 *
 * Le snapshot garde le `DisplayTitle` de Jellyfin (« Français - AAC - Stereo
 * - Default », « English (SDH) ») ; le lecteur natif, lui, ne rend que des
 * codes bruts. Ici, chaque piste native retrouve son flux du snapshot :
 * - une variante Allégée n'a qu'UNE piste audio, celle que le serveur a
 *   gardée (`audioStreamIndex`) — sinon la piste par défaut, sinon la première ;
 * - un Original garde ses pistes dans l'ordre du conteneur : appariement par
 *   position quand les comptes coïncident (ExoPlayer liste l'ordre du fichier),
 *   sinon par langue dans l'ordre (AVPlayer omet une piste qu'il ne décode pas).
 */

import type { SubtitleMode } from "@tentacle-tv/shared";
import { primaryLangSubtag } from "./langSubtags";

export interface SnapshotStream {
  Type: string;
  Index: number;
  Language?: string;
  Title?: string;
  DisplayTitle?: string;
  Codec?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
}

/** Forme de `onLoad.audioTracks[i]` de react-native-video. */
export interface NativeAudioTrack {
  index: number;
  title?: string;
  language?: string;
  selected?: boolean;
}

export interface FileAudioHint {
  variant: "original" | "light";
  audioStreamIndex: number | null;
}

/** Les flux audio du snapshot, dans l'ordre du conteneur (`Index` croissant). */
export function audioStreamsOf(streams: readonly SnapshotStream[]): SnapshotStream[] {
  return streams.filter((stream) => stream.Type === "Audio").sort((a, b) => a.Index - b.Index);
}

function knownLang(code: string | undefined): string | null {
  const raw = code?.trim().toLowerCase();
  if (!raw || raw === "und") return null;
  return primaryLangSubtag(raw.split(/[-_]/)[0]) ?? raw;
}

/** Piste native → flux du snapshot (ou `null`), même longueur que `native`. */
export function matchAudioStreams(
  native: readonly NativeAudioTrack[],
  streams: readonly SnapshotStream[],
  file: FileAudioHint,
): Array<SnapshotStream | null> {
  const audio = audioStreamsOf(streams);
  if (native.length === 0 || audio.length === 0) return native.map(() => null);

  if (file.variant === "light" && native.length === 1) {
    const kept =
      audio.find((stream) => stream.Index === file.audioStreamIndex) ??
      audio.find((stream) => stream.IsDefault === true) ??
      audio[0] ??
      null;
    return [kept];
  }

  if (native.length === audio.length) return native.map((_, position) => audio[position] ?? null);

  // Comptes différents : par langue, dans l'ordre, chaque flux servi une fois.
  const remaining = [...audio];
  return native.map((track) => {
    const lang = knownLang(track.language);
    if (lang === null) return null;
    const at = remaining.findIndex((stream) => knownLang(stream.Language) === lang);
    if (at < 0) return null;
    const [stream] = remaining.splice(at, 1);
    return stream ?? null;
  });
}

/** Le libellé « comme en ligne » : `DisplayTitle`, sinon `Title`, sinon le formateur de l'appelant. */
export function snapshotTrackLabel(stream: SnapshotStream | null | undefined, fallback: () => string): string {
  const display = stream?.DisplayTitle?.trim();
  if (display) return display;
  const title = stream?.Title?.trim();
  if (title) return title;
  return fallback();
}

const SIGNS_RE = /\b(signs?|songs?)\b/i;

/**
 * Le mode de sous-titres qu'exprime un choix explicite, d'après les DRAPEAUX
 * de la piste (pas d'après un libellé qui peut être dégradé) : forcée →
 * `forced`, « signs / songs » dans le titre → `signs`, sinon — SDH compris —
 * `always`.
 */
export function subtitleModeOf(track: { forced: boolean; sdh: boolean; title?: string; displayTitle?: string }): SubtitleMode {
  if (track.forced) return "forced";
  if (SIGNS_RE.test(track.title ?? "") || SIGNS_RE.test(track.displayTitle ?? "")) return "signs";
  return "always";
}
