/**
 * Octave — POURQUOI un titre importé n'a pas été reconnu, dit au journal (`[music-import]`) quand la bibliothèque
 * a un titre du MÊME NOM : un autre artiste, ou une autre durée (une autre version : « Ma Meilleure Ennemie » avec
 * Coldplay dure 3:22, l'original de Stromae & Pomme 2:28 — deux enregistrements MusicBrainz). Rien n'est décidé
 * ici : la règle du cœur a tranché, ce relevé la rend lisible (`docker logs … | grep '\[music-import\]'`).
 * Après l'import, en fond, sur l'index local seulement : vingt absents au plus, dix candidats chacun.
 */

import type { ImportedTrack } from "../contract/musicImport";
import { sameTitle, shareArtist, type MatchArtist } from "../contract/musicLibraryMatch";
import { rowsNamed } from "../index/matchQueries";
import type { IndexRow } from "../index/indexTypes";
import { visibleRows, type UserView } from "../view/viewContext";

const EXAMINED = 20;
const CANDIDATES = 10;

export type NearMissReason = "artist" | "duration";

export interface NearMiss {
  reason: NearMissReason;
  row: IndexRow;
}

const credit = (names: readonly string[]): MatchArtist[] => names.map((name) => ({ name, mbid: null }));
const clock = (ms: number | null) => {
  if (ms === null) return "?";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Le candidat du même nom le plus proche et ce qui l'a écarté ; `null` : la bibliothèque n'a rien de ce nom. */
export function nearMiss(track: ImportedTrack, rows: readonly IndexRow[]): NearMiss | null {
  const named = rows.filter((r) => r.kind === "track" && sameTitle(r.name, track.title));
  const sameArtist = named.filter((r) => shareArtist(r.artists, credit(track.artists)));
  if (sameArtist.length === 0) return named[0] ? { reason: "artist", row: named[0] } : null;
  const gap = (r: IndexRow) => (r.durationMs !== null && track.durationMs !== null ? Math.abs(r.durationMs - track.durationMs) : 0);
  const closest = [...sameArtist].sort((a, b) => gap(a) - gap(b))[0] as IndexRow;
  return { reason: "duration", row: closest };
}

export function nearMissLine(track: ImportedTrack, miss: NearMiss): string {
  const own = `« ${miss.row.name} » (${miss.row.artists.map((a) => a.name).join(", ")} · ${clock(miss.row.durationMs)}${miss.row.albumName ? ` · ${miss.row.albumName}` : ""})`;
  const why = miss.reason === "artist" ? "autre artiste" : "autre durée, donc une autre version";
  return `[music-import] « ${track.title} » (${track.artists.join(", ")} · ${clock(track.durationMs)}) : la bibliothèque a ${own} — ${why}, laissé hors bibliothèque`;
}

/** Les lignes du journal pour les absents d'un import (les premiers seulement). */
export async function explainAbsent(view: UserView, absent: readonly ImportedTrack[]): Promise<string[]> {
  const lines: string[] = [];
  for (const track of absent.slice(0, EXAMINED)) {
    const miss = nearMiss(track, visibleRows(view, await rowsNamed("track", track.title, CANDIDATES)));
    if (miss) lines.push(nearMissLine(track, miss));
  }
  return lines;
}
