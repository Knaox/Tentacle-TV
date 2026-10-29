/**
 * Octave — une playlist (ou un album) DEEZER, par son API PUBLIQUE
 * (`api.deezer.com`, sans clé) : la playlist entière, page après page, avec
 * l'ISRC de chaque titre (la liste d'un album n'en donne pas). Une erreur de
 * l'API (`{ error: { code } }`) : 800 = introuvable ou privée, 4 = quota.
 */

import { MUSIC_IMPORT_LIMITS, type ImportedPlaylist, type ImportedTrack } from "../../contract/musicImport";
import type { ImportFetcher } from "../importFetch";
import { artistList, durationOf, field, ImportReadFailure, isrcOf, list, numbered, record } from "./readerKit";

const PAGE = 100;
/** Pages lues EN MÊME TEMPS (l'API admet 50 requêtes par 5 s). */
const PARALLEL_PAGES = 3;

type Raw = Record<string, unknown>;

async function api(fetcher: ImportFetcher, path: string): Promise<Raw> {
  const page = await fetcher(`https://api.deezer.com/${path}`, "json");
  if (page.status !== 200) throw new ImportReadFailure("unavailable");
  let body: Raw | null;
  try {
    body = record(JSON.parse(page.body));
  } catch {
    throw new ImportReadFailure("unavailable");
  }
  if (!body) throw new ImportReadFailure("unavailable");
  const error = record(body.error);
  if (error) throw new ImportReadFailure(error.code === 800 ? "notFound" : "unavailable");
  return body;
}

function trackOf(raw: Raw, album: string | null): Omit<ImportedTrack, "index"> {
  return {
    title: field(raw.title) ?? "",
    artists: artistList([record(raw.artist)?.name]),
    album: field(record(raw.album)?.title) ?? album,
    durationMs: durationOf(typeof raw.duration === "number" ? raw.duration * 1000 : null),
    isrc: isrcOf(raw.isrc),
    sourceId: raw.id == null ? null : String(raw.id),
    // `readable: false` : Deezer le réserve à d'autres pays (le motif du bilan, s'il n'entre pas).
    ...(raw.readable === false ? { sourceBlocked: "region" as const } : {}),
  };
}

/** Les pages qui manquent après la première (`index` = 100, 200, …), lues par petits groupes. */
async function remainingPages(fetcher: ImportFetcher, id: string, have: number, declared: number): Promise<Raw[]> {
  const offsets: number[] = [];
  for (let at = have; at < Math.min(declared, MUSIC_IMPORT_LIMITS.tracks); at += PAGE) offsets.push(at);
  const out: Raw[] = [];
  for (let i = 0; i < offsets.length; i += PARALLEL_PAGES) {
    const pages = await Promise.all(offsets.slice(i, i + PARALLEL_PAGES).map((at) => api(fetcher, `playlist/${id}/tracks?index=${at}&limit=${PAGE}`)));
    for (const page of pages) out.push(...list(page.data).map(record).filter((t): t is Raw => t !== null));
  }
  return out;
}

export async function readDeezer(fetcher: ImportFetcher, kind: "playlist" | "album", id: string): Promise<ImportedPlaylist> {
  const head = await api(fetcher, `${kind}/${id}`);
  const name = field(head.title);
  let raw = list(record(head.tracks)?.data).map(record).filter((t): t is Raw => t !== null);
  const declared = typeof head.nb_tracks === "number" ? head.nb_tracks : raw.length;
  if (kind === "playlist" && declared > raw.length) raw = [...raw, ...(await remainingPages(fetcher, id, raw.length, declared))];
  const { tracks, truncated } = numbered(raw.map((t) => trackOf(t, kind === "album" ? name : null)));
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  const artwork = field(head.picture_xl) ?? field(head.cover_xl);
  return {
    source: "deezer",
    name: name ?? "Deezer",
    tracks,
    truncated: truncated || declared > tracks.length,
    artworkUrl: artwork && /^https:\/\/[a-z0-9-]+\.dzcdn\.net\//.test(artwork) ? artwork : null,
  };
}
