/**
 * Octave — une liste COLLÉE, le repli de toute source : un CSV avec en-tête
 * (l'export d'un autre service : Exportify, TuneMyMusic, Soundiiz… — colonnes
 * reconnues par leur nom, en anglais ou en français), sinon une ligne par
 * titre, « Artiste - Titre » (ou « Titre<TAB>Artiste »). Pur, sans réseau.
 */

import { MUSIC_IMPORT_LIMITS, type ImportedPlaylist, type ImportedTrack } from "../../contract/musicImport";
import { artistList, durationOf, field, ImportReadFailure, isrcOf, numbered } from "./readerKit";

const COLUMNS = {
  title: ["track name", "track title", "title", "song", "song name", "name", "titre", "track"],
  artist: ["artist name(s)", "artist names", "artist name", "artists", "artist", "artiste", "artistes", "artist(s)"],
  album: ["album name", "album title", "album", "titre de l'album"],
  duration: ["duration (ms)", "duration_ms", "track duration (ms)", "duration", "durée", "length", "time"],
  isrc: ["isrc"],
  playlist: ["playlist name", "playlist", "nom de la playlist"],
} as const;

type Column = keyof typeof COLUMNS;

/** Une ligne CSV, guillemets doublés compris. */
export function csvCells(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (c === separator) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

/** « 3:45 » → 225 000 ; un grand nombre est déjà en millisecondes, un petit en secondes. */
export function parseDuration(value: string | undefined): number | null {
  if (!value) return null;
  const clock = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) return durationOf(((Number(clock[1] ?? 0) * 60 + Number(clock[2])) * 60 + Number(clock[3])) * 1000);
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return durationOf(n >= 10_000 ? n : n * 1000);
}

function headerOf(cells: string[]): Partial<Record<Column, number>> | null {
  const names = cells.map((c) => c.toLowerCase().replace(/^\uFEFF/, "").trim());
  const out: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(COLUMNS) as Column[]) {
    const at = (COLUMNS[column] as readonly string[]).map((n) => names.indexOf(n)).find((i) => i >= 0);
    if (at !== undefined) out[column] = at;
  }
  return out.title !== undefined && out.artist !== undefined ? out : null;
}

function separatorOf(line: string): string {
  const counts = [",", ";", "\t"].map((s) => [s, line.split(s).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",";
}

const DASH = /\s+[-–—]\s+/;

function lineTrack(line: string): Omit<ImportedTrack, "index"> | null {
  const text = line.replace(/^\s*\d+[.)]\s+/, "").trim();
  if (!text) return null;
  const tab = text.split("\t");
  const [artist, title] = tab.length >= 2 ? [tab[1], tab[0]] : DASH.test(text) ? [text.split(DASH)[0], text.split(DASH).slice(1).join(" - ")] : [null, text];
  const name = field(title);
  return name ? { title: name, artists: artistList([artist]), album: null, durationMs: null, isrc: null, sourceId: null } : null;
}

export function readText(text: string): ImportedPlaylist {
  const lines = text.slice(0, MUSIC_IMPORT_LIMITS.text).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new ImportReadFailure("empty");
  const separator = separatorOf(lines[0] ?? "");
  const header = headerOf(csvCells(lines[0] ?? "", separator));
  let name: string | null = null;
  const raw: Omit<ImportedTrack, "index">[] = [];
  if (header) {
    for (const line of lines.slice(1, MUSIC_IMPORT_LIMITS.tracks + 2)) {
      const cells = csvCells(line, separator);
      const at = (c: Column) => (header[c] === undefined ? undefined : cells[header[c] as number]);
      name ??= field(at("playlist"));
      raw.push({
        title: field(at("title")) ?? "",
        // Un seul crédit, tel quel : la règle du cœur découpe « A, B & C » (et garde « Earth, Wind & Fire » entier).
        artists: artistList([at("artist")]),
        album: field(at("album")),
        durationMs: parseDuration(at("duration")),
        isrc: isrcOf(at("isrc")),
        sourceId: null,
      });
    }
  } else {
    for (const line of lines.slice(0, MUSIC_IMPORT_LIMITS.tracks + 1)) {
      const track = lineTrack(line);
      if (track) raw.push(track);
    }
  }
  const { tracks, truncated } = numbered(raw);
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  return { source: "text", name: name ?? "", tracks, truncated, artworkUrl: null };
}
