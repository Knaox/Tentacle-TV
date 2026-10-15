/**
 * La bibliothèque par le proxy Jellyfin de Tentacle : chaque liste qu'un client
 * lit (web, bureau, Apple TV) ne contient que des titres de la référence, la
 * liste complète lui est ÉGALE (rien de trop, rien de moins), et chaque accès
 * DIRECT par l'id d'un titre interdit est refusé — fiche, lecture, flux,
 * vignettes, semblables, épisodes, listes par parent ou par ids.
 */

import type { Door } from "./doors";
import { itemIdsOf, probe, type JudgeContext } from "./judge";
import type { LibraryKey } from "./catalog";

const q = encodeURIComponent;

export async function probeLibrary(ctx: JudgeContext, door: Door, libraries: Record<LibraryKey, string>): Promise<void> {
  const U = ctx.ref.account.id;
  const { ref, rec } = ctx;
  const allIds = ref.all.filter((i) => i.type !== "CollectionFolder" && i.type !== "UserView").map((i) => i.id);
  const series = ref.all.filter((i) => i.type === "Series");
  const movies = ref.all.filter((i) => i.type === "Movie");
  const witness = movies.find((m) => ref.visible.has(m.id));

  // La liste complète : ÉGALE à celle que Jellyfin montre au compte.
  const full = await probe(ctx, door, "GET", `/api/jellyfin/Users/${U}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds`);
  const expected = ref.all.filter((i) => (i.type === "Movie" || i.type === "Series") && ref.visible.has(i.id)).map((i) => i.id).sort();
  const got = itemIdsOf(full.json).sort();
  rec.note(JSON.stringify(got) === JSON.stringify(expected), `${door.label} · bibliothèque complète = référence de Jellyfin (${got.length}/${expected.length})`);

  const lists = [
    `/api/jellyfin/Users/${U}/Views`,
    `/api/jellyfin/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode`,
    `/api/jellyfin/Users/${U}/Items/Resume?Limit=50`,
    `/api/jellyfin/Shows/NextUp?userId=${U}&Limit=50`,
    `/api/jellyfin/Items?Ids=${allIds.join(",")}&userId=${U}`,
    `/api/jellyfin/Users/${U}/Items?Ids=${allIds.join(",")}`,
    `/api/jellyfin/Users/${U}/Items?Filters=IsFavorite&Recursive=true`,
    `/api/jellyfin/Users/${U}/Items?Filters=IsPlayed&Recursive=true&IncludeItemTypes=Movie,Episode`,
    ...Object.values(libraries).flatMap((lib) => [
      `/api/jellyfin/Users/${U}/Items/Latest?ParentId=${lib}&Limit=20`,
      `/api/jellyfin/Users/${U}/Items?ParentId=${lib}&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=20`,
      `/api/jellyfin/Users/${U}/Items?ParentId=${lib}&Recursive=true&IncludeItemTypes=Episode&SortBy=DateCreated&SortOrder=Descending&Limit=20`,
      `/api/jellyfin/Items?ParentId=${lib}&Recursive=true&userId=${U}&StartIndex=0&Limit=100`,
    ]),
    ...series.flatMap((s) => [
      `/api/jellyfin/Shows/${s.id}/Episodes?userId=${U}`,
      `/api/jellyfin/Shows/${s.id}/Seasons?userId=${U}`,
      `/api/jellyfin/Shows/NextUp?userId=${U}&SeriesId=${s.id}`,
    ]),
    ...(witness ? [`/api/jellyfin/Items/${witness.id}/Similar?userId=${U}&Limit=50`] : []),
    ...["prince", "fight", "patrouille", "bebop", "chihiro", "saut", "chute"].flatMap((term) => [
      `/api/jellyfin/Search/Hints?searchTerm=${q(term)}&userId=${U}`,
      `/api/jellyfin/Items?searchTerm=${q(term)}&Recursive=true&userId=${U}&IncludeItemTypes=Movie,Series,Episode`,
    ]),
  ];
  for (const path of lists) await probe(ctx, door, "GET", path);

  // Accès DIRECTS par l'id d'un titre interdit.
  for (const item of ref.forbidden.filter((i) => i.type === "Movie" || i.type === "Series" || i.type === "Episode")) {
    for (const [method, path] of [
      ["GET", `/api/jellyfin/Users/${U}/Items/${item.id}`],
      ["GET", `/api/jellyfin/Items/${item.id}?userId=${U}`],
      ["POST", `/api/jellyfin/Items/${item.id}/PlaybackInfo?userId=${U}`],
      ["GET", `/api/jellyfin/Videos/${item.id}/stream?static=true`],
      ["GET", `/api/jellyfin/Videos/${item.id}/master.m3u8?MediaSourceId=${item.id}`],
      ["GET", `/api/jellyfin/items/${item.id}/trickplay/320/0.jpg`],
      ["GET", `/api/jellyfin/Items/${item.id}/Similar?userId=${U}`],
    ] as const) {
      await probe(ctx, door, method, path, { status: [403, 404] }, method === "POST" ? {} : undefined);
    }
  }
}
