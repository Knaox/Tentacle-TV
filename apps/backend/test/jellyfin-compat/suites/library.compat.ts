import { QueryClient } from "@tanstack/react-query";
import { expect } from "vitest";
import { getLibraryCatalogKey, prefetchLibraryCatalog } from "../../../../../packages/api-client/src/hooks/useLibraryCatalog";
import { check, feature } from "../harness";
import { ctx, tentacleClient, type ItemsPage } from "./support";

interface Named { Id: string; Name: string; Type?: string; CollectionType?: string; SeriesId?: string; IndexNumber?: number }

const library = (name: string): string => {
  const hit = ctx().libraries.find((l) => l.name === name);
  if (!hit) throw new Error(`bibliothèque ${name} absente`);
  return hit.id;
};

feature("library.views", () => {
  check("bibliothèques du compte : films, séries et mixte (route héritée traduite)", async () => {
    const views = await tentacleClient(ctx().user.token).fetch<ItemsPage<Named>>(`/Users/${ctx().user.id}/Views`);
    const names = views.Items.map((v) => v.Name).sort();
    expect(names).toEqual(["Films", "Mixte", "Séries"]);
    expect(views.Items.find((v) => v.Name === "Films")?.CollectionType).toBe("movies");
    expect(views.Items.find((v) => v.Name === "Séries")?.CollectionType).toBe("tvshows");
  });
});

feature("library.catalog", () => {
  const catalog = async (libraryName: string, filters: Parameters<typeof prefetchLibraryCatalog>[4] = {}): Promise<Named[]> => {
    const qc = new QueryClient();
    const libraryId = library(libraryName);
    // Duck-typé v4/v5 côté api-client : le QueryClient v5 s'y passe par transtypage, comme au web.
    await prefetchLibraryCatalog(qc as unknown as Parameters<typeof prefetchLibraryCatalog>[0], tentacleClient(ctx().user.token), ctx().user.id, libraryId, filters);
    const state = qc.getQueryState(getLibraryCatalogKey(libraryId, filters));
    if (state?.error) throw state.error;
    const data = qc.getQueryData<{ pages: Array<ItemsPage<Named>> }>(getLibraryCatalogKey(libraryId, filters));
    return data?.pages.flatMap((p) => p.Items) ?? [];
  };

  check("catalogue des films (prefetchLibraryCatalog de l'api-client)", async () => {
    const names = (await catalog("Films")).map((i) => i.Name);
    expect(names.length).toBeGreaterThanOrEqual(5);
    expect(names).toContain("Big Buck Bunny");
  });

  check("tri par nom, ordre croissant", async () => {
    const names = (await catalog("Films", { sortBy: "SortName", sortOrder: "Ascending" })).map((i) => i.Name);
    expect([...names].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))).toEqual(names);
  });

  check("séries de la bibliothèque et filtre « non vus »", async () => {
    const all = await catalog("Séries");
    expect(all.map((i) => i.Type)).toContain("Series");
    const unplayed = await catalog("Séries", { statusFilter: "IsUnplayed" });
    expect(unplayed.length).toBeGreaterThan(0);
  });

  check("genres et studios d'une bibliothèque", async () => {
    const client = tentacleClient(ctx().user.token);
    const genres = await client.fetch<ItemsPage<Named>>(`/Genres?ParentId=${library("Films")}&UserId=${ctx().user.id}&Fields=PrimaryImageAspectRatio`);
    const studios = await client.fetch<ItemsPage<Named>>(`/Studios?ParentId=${library("Films")}&UserId=${ctx().user.id}`);
    expect(Array.isArray(genres.Items)).toBe(true);
    expect(Array.isArray(studios.Items)).toBe(true);
    if (genres.Items.length === 0) return { partial: "aucun genre (métadonnées TMDB absentes ?)" };
  });
});

feature("library.home", () => {
  const client = () => tentacleClient(ctx().user.token);
  const u = () => ctx().user.id;
  const { bbb } = ctx().fixtures.movies;
  const { bbS01E01, bbS01E02 } = ctx().fixtures.episodes;

  check("reprise : un titre entamé remonte (Users/{u}/Items/Resume)", async () => {
    await client().fetch(`/UserItems/${bbb}/UserData`, { method: "POST", body: JSON.stringify({ PlaybackPositionTicks: 150_000_000, LastPlayedDate: new Date().toISOString() }) });
    const resume = await client().fetch<ItemsPage<Named>>(
      `/Users/${u()}/Items/Resume?Limit=12&Recursive=true&IncludeItemTypes=Movie,Episode&Fields=Overview,PrimaryImageAspectRatio,MediaSources,ProviderIds,Trickplay&MediaTypes=Video&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&EnableUserData=true`,
    );
    expect(resume.Items.map((i) => i.Id)).toContain(bbb);
  });

  check("à suivre : l'épisode d'après un épisode vu (Shows/NextUp)", async () => {
    await client().fetch(`/Users/${u()}/PlayedItems/${bbS01E01}`, { method: "POST" });
    const next = await client().fetch<ItemsPage<Named>>(`/Shows/NextUp?userId=${u()}&Limit=12&EnableResumable=false&Fields=Overview,PrimaryImageAspectRatio,MediaSources&EnableUserData=true`);
    expect(next.Items.map((i) => i.Id)).toContain(bbS01E02);
  });

  check("nouveautés : derniers ajouts d'une bibliothèque", async () => {
    const latest = await client().fetch<ItemsPage<Named>>(
      `/Users/${u()}/Items?ParentId=${library("Films")}&Recursive=true&IncludeItemTypes=Movie&SortBy=DateCreated&SortOrder=Descending&Limit=16&Fields=Overview,PrimaryImageAspectRatio,MediaSources&EnableUserData=true`,
    );
    expect(latest.Items.length).toBeGreaterThanOrEqual(5);
  });
});
