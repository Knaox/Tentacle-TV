import { expect } from "vitest";
import type { MediaItem } from "../../../../../packages/shared/src/types/media";
import { fetchIncludedInCollections } from "../../../../../packages/api-client/src/hooks/useIncludedInCollections";
import { applies, check, feature } from "../harness";
import { ctx, jellyfin, tentacleClient, type ItemsPage } from "./support";

/** Les champs que la fiche demande (`useMediaItem`, packages/api-client/src/hooks/useLibrary.ts). */
const DETAIL_FIELDS = "Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status";

feature("details.item", () => {
  const u = () => ctx().user.id;
  const { bbb, sintel } = ctx().fixtures.movies;

  check("fiche complète d'un film (champs de useMediaItem)", async () => {
    const item = await tentacleClient(ctx().user.token).fetch<MediaItem>(`/Users/${u()}/Items/${bbb}?Fields=${DETAIL_FIELDS}&EnableUserData=true`);
    expect(item.Name).toBe("Big Buck Bunny");
    expect(item.MediaSources?.[0]?.MediaStreams?.some((s) => s.Type === "Video")).toBe(true);
    // 10.10 rend le code du fichier (« fre ») ; 10.11 et 12.x le normalisent (« fra »).
    expect(item.MediaSources?.[0]?.MediaStreams?.some((s) => s.Type === "Subtitle" && /^fr(e|a)$/.test(s.Language ?? ""))).toBe(true);
    expect(item.Chapters?.map((c) => c.Name)).toEqual(["Intro", "Histoire", "Générique"]);
    expect(item.UserData).toBeTruthy();
    if (!item.ProviderIds?.Tmdb) return { partial: "pas d'identifiant TMDB (scan sans métadonnées distantes)" };
  });

  check("un film en deux versions expose ses deux sources", async () => {
    const item = await tentacleClient(ctx().user.token).fetch<MediaItem>(`/Users/${u()}/Items/${sintel}?Fields=MediaSources`);
    expect(item.MediaSources?.length).toBe(2);
  });

  check("route héritée et forme documentée rendent la même fiche (hypothèse de la traduction du proxy)", async () => {
    const legacy = await jellyfin(`/Users/${u()}/Items/${bbb}`, ctx().user.token);
    // Alias retiré par une version future : rien à comparer, le proxy traduit déjà.
    if (legacy.status === 404) return;
    const modern = await jellyfin(`/Items/${bbb}?userId=${u()}`, ctx().user.token);
    expect(await legacy.json()).toEqual(await modern.json());
  });

  check("ancêtres et titres similaires", async () => {
    const client = tentacleClient(ctx().user.token);
    const ancestors = await client.fetch<Array<{ Id: string; Type: string }>>(`/Items/${bbb}/Ancestors?userId=${u()}`);
    expect(ancestors.some((a) => a.Type === "CollectionFolder")).toBe(true);
    const similar = await client.fetch<ItemsPage>(`/Items/${bbb}/Similar?userId=${u()}&Limit=24&Fields=Overview,PrimaryImageAspectRatio,ParentId,MediaSources&EnableUserData=true`);
    expect(Array.isArray(similar.Items)).toBe(true);
  });

  // « Fait partie de » (Jellyfin 12) : avant, la route n'existe pas — la rangée
  // doit rester vide sans que la fiche n'échoue.
  check("« Fait partie de » : vide sans erreur quand le serveur ne le sait pas", async () => {
    const collections = await fetchIncludedInCollections(tentacleClient(ctx().user.token), bbb, u());
    expect(collections).toEqual([]);
  }, { skip: applies("jellyfin12.included-in") });
});

feature("details.series", () => {
  const u = () => ctx().user.id;
  const { breakingBad } = ctx().fixtures.series;
  const { bb1 } = ctx().fixtures.seasons;
  const { bbS01E02 } = ctx().fixtures.episodes;

  check("saisons, spéciaux compris (champs de useSeasons)", async () => {
    const seasons = await tentacleClient(ctx().user.token).fetch<ItemsPage<MediaItem>>(
      `/Shows/${breakingBad}/Seasons?userId=${u()}&Fields=PrimaryImageAspectRatio,RemoteTrailers,RecursiveItemCount,SpecialFeatureCount`,
    );
    expect(seasons.Items.map((s) => s.IndexNumber).sort()).toEqual([0, 1, 2]);
  });

  check("épisodes d'une saison", async () => {
    const episodes = await tentacleClient(ctx().user.token).fetch<ItemsPage<MediaItem>>(
      `/Shows/${breakingBad}/Episodes?SeasonId=${bb1}&userId=${u()}&Fields=Overview,PrimaryImageAspectRatio&EnableUserData=true`,
    );
    expect(episodes.Items.map((e) => e.IndexNumber)).toEqual([1, 2, 3]);
  });

  check("épisodes voisins (adjacentTo, navigation et épisode suivant)", async () => {
    const around = await tentacleClient(ctx().user.token).fetch<ItemsPage<MediaItem>>(
      `/Shows/${breakingBad}/Episodes?seasonId=${bb1}&adjacentTo=${bbS01E02}&userId=${u()}&isMissing=false&fields=MediaSources`,
    );
    expect(around.Items.map((e) => e.IndexNumber)).toEqual([1, 2, 3]);
  });
});
