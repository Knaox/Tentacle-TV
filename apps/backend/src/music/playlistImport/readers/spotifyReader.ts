/**
 * Octave — une playlist (ou un album) SPOTIFY, sans compte ni clé : la page
 * d'intégration publique (`open.spotify.com/embed/…`) porte la liste dans son
 * `__NEXT_DATA__` (relevé du 26/10/2026). Elle ne montre que les 100 PREMIERS
 * titres : au-delà, `truncated` le dit (aucune page publique n'en donne plus ;
 * le jeton de la page n'est JAMAIS réemployé par le cœur — lot « pg », 10/11 :
 * la lecture entière passe par une extension qui déclare `importReadFirst`). Ni
 * album, ni ISRC, ni pochette par titre ; le contenu explicite, oui. Les artistes
 * y sont joints par « ,  » (virgule + espace insécable) — « Earth, Wind & Fire »
 * garde sa virgule ordinaire.
 */

import type { ImportedPlaylist } from "../../contract/musicImport";
import type { ImportFetcher } from "../importFetch";
import { artistList, durationOf, field, ImportReadFailure, list, numbered, record, scriptJson } from "./readerKit";

/** La page d'intégration n'en montre pas plus. */
export const SPOTIFY_EMBED_CAP = 100;

/** Les hôtes d'images de Spotify (relevé du 10/11 : une couverture de playlist sur `image-cdn-ak.spotifycdn.com`). */
const SPOTIFY_IMAGE_HOST = /^https:\/\/(?:i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z]{2}\.spotifycdn\.com)\//;

function entityOf(html: string): Record<string, unknown> {
  const props = record(record(record(scriptJson(html, "__NEXT_DATA__"))?.props)?.pageProps);
  if (!props) throw new ImportReadFailure("unavailable");
  if (props.status === 404) throw new ImportReadFailure("notFound");
  const entity = record(record(record(props.state)?.data)?.entity);
  if (!entity) throw new ImportReadFailure("unavailable");
  return entity;
}

function artworkOf(entity: Record<string, unknown>): string | null {
  const sources = list(record(entity.coverArt)?.sources).map(record);
  const best = sources.sort((a, b) => Number(b?.width ?? 0) - Number(a?.width ?? 0))[0];
  const url = field(best?.url);
  return url && SPOTIFY_IMAGE_HOST.test(url) ? url : null;
}

export function parseSpotifyEmbed(html: string, kind: "playlist" | "album"): ImportedPlaylist {
  const entity = entityOf(html);
  const name = field(entity.name) ?? field(entity.title);
  const raw = list(entity.trackList).map(record).filter((t): t is Record<string, unknown> => t !== null);
  const { tracks, truncated } = numbered(
    raw.map((t) => ({
      title: field(t.title) ?? "",
      artists: artistList(String(t.subtitle ?? "").split(", ")),
      album: kind === "album" ? name : null,
      durationMs: durationOf(t.duration),
      isrc: null,
      sourceId: field(t.uri),
      // `isPlayable: false` : Spotify ne le joue pas, sans dire pourquoi (le motif du bilan, s'il n'entre pas).
      ...(t.isPlayable === false ? { sourceBlocked: "refused" as const } : {}),
      ...(t.isExplicit === true ? { explicit: true as const } : {}),
    })),
  );
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  return {
    source: "spotify",
    name: name ?? "Spotify",
    tracks,
    truncated: truncated || (kind === "playlist" && raw.length >= SPOTIFY_EMBED_CAP),
    artworkUrl: artworkOf(entity),
  };
}

export async function readSpotify(fetcher: ImportFetcher, kind: "playlist" | "album", id: string): Promise<ImportedPlaylist> {
  const page = await fetcher(`https://open.spotify.com/embed/${kind}/${id}`, "html");
  if (page.status === 404) throw new ImportReadFailure("notFound");
  if (page.status !== 200) throw new ImportReadFailure("unavailable");
  return parseSpotifyEmbed(page.body, kind);
}
