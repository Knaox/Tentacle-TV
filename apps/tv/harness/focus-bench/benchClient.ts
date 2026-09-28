import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SEASONS, SERIES_ID, allSeriesEpisodes, seasonEpisodes } from "./fixtures";
import { CARD_ITEMS, SECOND_SERIES_EPISODES, SECOND_SERIES_ID } from "./cardFixtures";

/**
 * Le client Jellyfin du banc : les données factices, sans réseau ni compte.
 *
 * Les bascules des cartes (favori, vu, Ma liste) changent l'état POUR DE BON,
 * en mémoire : les relectures qui suivent une mutation le rendent, comme un
 * vrai serveur — c'est ce qui permet de voir la feuille d'actions et les
 * marqueurs basculer. Les images passent par le relais du banc, à l'adresse
 * d'où l'application a chargé son code (`baseUrl`).
 */

type UserData = NonNullable<MediaItem["UserData"]>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createBenchClient(baseUrl: string): JellyfinClient {
  const patches = new Map<string, Partial<UserData>>();
  const byId = new Map(CARD_ITEMS.map((item) => [item.Id, item]));
  const withState = (item: MediaItem): MediaItem => {
    const patch = patches.get(item.Id);
    return patch ? ({ ...item, UserData: { ...item.UserData, ...patch } } as MediaItem) : item;
  };
  const patch = (id: string, change: Partial<UserData>) => patches.set(id, { ...patches.get(id), ...change });
  const seriesWith = (flag: "Likes" | "IsFavorite") =>
    CARD_ITEMS.filter((item) => item.Type === "Series" && withState(item).UserData?.[flag] === true)
      .map((item) => ({ Id: item.Id }));

  const client = {
    async fetch(url: string, init?: { method?: string }) {
      const method = init?.method ?? "GET";
      let match = url.match(/\/Users\/[^/]+\/FavoriteItems\/([^/?]+)/);
      if (match) {
        patch(match[1], { IsFavorite: method === "POST" });
        await wait(80);
        return {};
      }
      match = url.match(/\/Users\/[^/]+\/PlayedItems\/([^/?]+)/);
      if (match) {
        patch(match[1], method === "POST"
          ? { Played: true, PlaybackPositionTicks: 0, PlayedPercentage: 0 }
          : { Played: false });
        await wait(80);
        return {};
      }
      match = url.match(/\/Users\/[^/]+\/Items\/([^/?]+)\/Rating/);
      if (match) {
        patch(match[1], { Likes: method === "POST" });
        await wait(80);
        return {};
      }
      if (url.includes("/Items?Filters=Likes")) return { Items: seriesWith("Likes") };
      if (url.includes("/Items?Filters=IsFavorite")) return { Items: seriesWith("IsFavorite") };
      match = url.match(/\/Users\/[^/]+\/Items\/([^/?]+)\?/);
      if (match) {
        const item = byId.get(match[1]);
        if (!item) throw new Error(`banc : item inconnu ${match[1]}`);
        await wait(120);
        return withState(item);
      }
      if (url.startsWith(`/Shows/${SERIES_ID}/Seasons`)) {
        await wait(120);
        return { Items: SEASONS };
      }
      match = url.match(/\/Shows\/[^/]+\/Episodes\?SeasonId=([^&]+)/);
      if (match) {
        const full = url.includes("MediaSources");
        await wait(full ? 700 : 150);
        return { Items: seasonEpisodes(match[1], full) };
      }
      // Tous les épisodes d'une série : l'état de visionnage (`useSeriesWatchState`).
      match = url.match(/\/Shows\/([^/]+)\/Episodes\?/);
      if (match) {
        await wait(150);
        return { Items: match[1] === SECOND_SERIES_ID ? SECOND_SERIES_EPISODES : allSeriesEpisodes() };
      }
      throw new Error(`banc : requête non servie ${url}`);
    },
    getImageUrl(itemId: string) {
      return `${baseUrl}bench/thumb.png?id=${encodeURIComponent(itemId)}`;
    },
  };
  return client as unknown as JellyfinClient;
}
