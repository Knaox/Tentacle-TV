/**
 * Octave — la lecture FERMÉE du corps de `POST /api/music/import` : un lien
 * RECONNU (liste fermée d'hôtes), un texte borné, ou une playlist déjà lue
 * par une extension, revérifiée champ par champ. Tout le reste : 400.
 */

import {
  MUSIC_IMPORT_LIMITS,
  MUSIC_IMPORT_SOURCES,
  recognizeImportUrl,
  type ImportedPlaylist,
  type ImportedTrack,
  type MusicImportSource,
} from "../contract/musicImport";
import { artistList, durationOf, field, isrcOf, list, numbered, record } from "./readers/readerKit";
import type { ImportInput } from "./readSource";

export interface ImportRequestParsed {
  input: ImportInput;
  name: string | null;
  keepEmpty: boolean;
}

export type ImportInputRefusal = "invalid_input" | "unsupported_url";

const NAME_MAX = 200;

function nameOf(value: unknown): string | null {
  const name = field(value);
  return name ? name.slice(0, NAME_MAX) : null;
}

/** Une playlist venue d'une extension : mêmes bornes que celles que le cœur lit lui-même. */
export function sanitizePlaylist(raw: ImportedPlaylist): ImportedPlaylist {
  const tracks = list(raw.tracks)
    .slice(0, MUSIC_IMPORT_LIMITS.tracks)
    .map(record)
    .filter((t): t is Record<string, unknown> => t !== null)
    .map(
      (t): Omit<ImportedTrack, "index"> => ({
        title: field(t.title) ?? "",
        artists: artistList(list(t.artists)),
        album: field(t.album),
        durationMs: durationOf(t.durationMs),
        isrc: isrcOf(t.isrc),
        sourceId: field(t.sourceId),
      }),
    );
  const numberedTracks = numbered(tracks);
  const artwork = field(raw.artworkUrl);
  return {
    source: raw.source,
    name: nameOf(raw.name) ?? "",
    tracks: numberedTracks.tracks,
    truncated: raw.truncated === true || numberedTracks.truncated || list(raw.tracks).length > MUSIC_IMPORT_LIMITS.tracks,
    artworkUrl: artwork && artwork.startsWith("https://") ? artwork : null,
  };
}

function playlistOf(value: unknown): ImportedPlaylist | null {
  const raw = record(value);
  const source = MUSIC_IMPORT_SOURCES.find((s) => s === raw?.source) as MusicImportSource | undefined;
  if (!raw || !source || !Array.isArray(raw.tracks)) return null;
  return sanitizePlaylist(raw as unknown as ImportedPlaylist);
}

export function parseImportRequest(body: unknown): { ok: true; value: ImportRequestParsed } | { ok: false; refusal: ImportInputRefusal } {
  const raw = record(body);
  if (!raw) return { ok: false, refusal: "invalid_input" };
  const options = { name: nameOf(raw.name), keepEmpty: raw.keepEmpty === true };
  const given = [raw.url, raw.text, raw.playlist].filter((v) => v !== undefined).length;
  if (given !== 1) return { ok: false, refusal: "invalid_input" };
  if (typeof raw.url === "string") {
    const url = recognizeImportUrl(raw.url);
    return url ? { ok: true, value: { ...options, input: { kind: "url", url } } } : { ok: false, refusal: "unsupported_url" };
  }
  if (typeof raw.text === "string") {
    if (raw.text.length > MUSIC_IMPORT_LIMITS.text || raw.text.trim().length === 0) return { ok: false, refusal: "invalid_input" };
    return { ok: true, value: { ...options, input: { kind: "text", text: raw.text } } };
  }
  const playlist = playlistOf(raw.playlist);
  return playlist ? { ok: true, value: { ...options, input: { kind: "playlist", playlist } } } : { ok: false, refusal: "invalid_input" };
}
