/**
 * Octave — une playlist (ou un album) DEEZER, par son API PUBLIQUE
 * (`api.deezer.com`, sans clé) : la playlist ENTIÈRE, pages de 500 en
 * parallèle borné (`pagedRead.ts`), avec l'ISRC, la pochette et le contenu
 * explicite de chaque titre (la liste d'un album n'en donne pas l'ISRC). Une erreur de
 * l'API (`{ error: { code } }`) : 800 = introuvable ou privée, 4 = quota.
 */

import { MUSIC_IMPORT_LIMITS, type ImportedPlaylist, type ImportedTrack } from "../../contract/musicImport";
import type { ImportFetcher } from "../importFetch";
import { artistList, durationOf, field, ImportReadFailure, isrcOf, list, numbered, record } from "./readerKit";
import { readAllPages } from "./pagedRead";

/**
 * Une page de l'API (mesuré le 10/11 : `limit=1000` admis, ~2 Mo et ~2 s la page — la durée suit la taille) : des
 * pages de 500, six en vol, lisent 9 000 titres en trois vagues d'une seconde, bien sous le plafond de débit.
 */
const PAGE = 500;
/** Pages EN MÊME TEMPS, et le plafond de l'API (50 requêtes par 5 s, gardé à 40). */
const PARALLEL_PAGES = 6;
const RATE = { requests: 40, windowMs: 5_000 };

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
    artworkUrl: deezerImage(record(raw.album)?.cover_medium),
    ...(raw.explicit_lyrics === true ? { explicit: true as const } : {}),
    // `readable: false` : Deezer le réserve à d'autres pays (le motif du bilan, s'il n'entre pas).
    ...(raw.readable === false ? { sourceBlocked: "region" as const } : {}),
  };
}

const deezerImage = (value: unknown): string | null => {
  const url = field(value);
  return url && /^https:\/\/[a-z0-9-]+\.dzcdn\.net\//.test(url) ? url : null;
};

/** Les titres qui manquent après ceux de la tête (`have`), par le fournisseur de pages : parallèle borné, débit gardé. */
async function remainingTracks(fetcher: ImportFetcher, id: string, have: number, declared: number): Promise<{ raw: Raw[]; truncated: boolean }> {
  const read = await readAllPages<Raw>(
    {
      page: async (offset, limit) => {
        const page = await api(fetcher, `playlist/${id}/tracks?index=${offset}&limit=${limit}`);
        return { items: list(page.data).map(record).filter((t): t is Raw => t !== null), total: typeof page.total === "number" ? page.total : null };
      },
      pageSize: PAGE,
      parallel: PARALLEL_PAGES,
      rate: RATE,
    },
    MUSIC_IMPORT_LIMITS.tracks,
    { start: have, total: declared },
  );
  return { raw: read.items, truncated: read.truncated };
}

export async function readDeezer(fetcher: ImportFetcher, kind: "playlist" | "album", id: string): Promise<ImportedPlaylist> {
  const head = await api(fetcher, `${kind}/${id}`);
  const name = field(head.title);
  let raw = list(record(head.tracks)?.data).map(record).filter((t): t is Raw => t !== null);
  const declared = typeof head.nb_tracks === "number" ? head.nb_tracks : raw.length;
  let cut = false;
  if (kind === "playlist" && declared > raw.length) {
    const rest = await remainingTracks(fetcher, id, raw.length, declared);
    raw = [...raw, ...rest.raw];
    cut = rest.truncated;
  }
  const { tracks, truncated } = numbered(raw.map((t) => trackOf(t, kind === "album" ? name : null)));
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  // Deezer tait quelques titres qu'il ne sert plus (999 lus sur une page de 1 000, mesuré le 10/11) : une marge.
  const short = declared - tracks.length > Math.max(10, declared * 0.02);
  return { source: "deezer", name: name ?? "Deezer", tracks, truncated: truncated || cut || short, artworkUrl: deezerImage(head.picture_xl) ?? deezerImage(head.cover_xl) };
}
