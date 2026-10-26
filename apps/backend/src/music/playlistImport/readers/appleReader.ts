/**
 * Octave — une playlist (ou un album) APPLE MUSIC, sans compte ni clé : la
 * page publique `music.apple.com` porte la liste dans `serialized-server-data`
 * (sections `…-detail-header` et `track-list`, relevé du 26/10/2026). L'en-tête
 * dit `trackCount` : une page qui en montre moins le dit par `truncated`.
 * Les artistes sont les liens du sous-titre (un par artiste), sinon
 * `artistName` ; l'album, le premier lien tertiaire (playlist) ou l'en-tête.
 */

import type { ImportedPlaylist } from "../../contract/musicImport";
import type { ImportFetcher } from "../importFetch";
import { artistList, durationOf, field, ImportReadFailure, list, numbered, record, scriptJson } from "./readerKit";

type Item = Record<string, unknown>;

function sectionsOf(html: string): Item[] {
  const root = record(scriptJson(html, "serialized-server-data"));
  const page = record(record(list(root?.data)[0])?.data);
  const sections = list(page?.sections).map(record).filter((s): s is Item => s !== null);
  if (sections.length === 0) throw new ImportReadFailure("unavailable");
  return sections;
}

const titlesOf = (links: unknown): string[] => list(links).map((l) => String(record(l)?.title ?? ""));

/** « Housewife - Single » → « Housewife » : le nom de l'album dans la bibliothèque n'a pas ce suffixe. */
function albumName(title: string | null): string | null {
  return title ? title.replace(/\s+-\s+(?:Single|EP)$/i, "") : null;
}

function artworkOf(header: Item | null): string | null {
  const url = field(record(record(header?.artwork)?.dictionary)?.url);
  if (!url || !/^https:\/\/is\d+-ssl\.mzstatic\.com\//.test(url)) return null;
  return url.replace("{w}", "600").replace("{h}", "600").replace("{f}", "jpg");
}

export function parseApplePage(html: string, kind: "playlist" | "album"): ImportedPlaylist {
  const sections = sectionsOf(html);
  const header = record(list(sections[0]?.items)[0]);
  const trackSection = sections.find((s) => s.itemKind === "trackLockup");
  const items = list(trackSection?.items).map(record).filter((t): t is Item => t !== null);
  const name = field(header?.title);
  const { tracks, truncated } = numbered(
    items.map((t) => {
      const linked = titlesOf(t.subtitleLinks);
      return {
        title: field(t.title) ?? "",
        artists: artistList(linked.length > 0 ? linked : [t.artistName]),
        album: kind === "album" ? albumName(name) : albumName(field(titlesOf(t.tertiaryLinks)[0])),
        durationMs: durationOf(t.duration),
        isrc: null,
        sourceId: field(record(record(t.contentDescriptor)?.identifiers)?.storeAdamID),
      };
    }),
  );
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  const declared = typeof header?.trackCount === "number" ? header.trackCount : 0;
  return { source: "apple", name: albumName(name) ?? "Apple Music", tracks, truncated: truncated || declared > items.length, artworkUrl: artworkOf(header) };
}

export async function readApple(fetcher: ImportFetcher, kind: "playlist" | "album", url: string): Promise<ImportedPlaylist> {
  const page = await fetcher(url, "html");
  if (page.status === 404) throw new ImportReadFailure("notFound");
  if (page.status !== 200) throw new ImportReadFailure("unavailable");
  return parseApplePage(page.body, kind);
}
