/**
 * Le FAUX serveur du banc : `fetch` répond aux requêtes des panneaux du lecteur (saisons,
 * épisodes, fiche) avec les données du labo, et par un 404 immédiat à tout le reste de `/api`.
 * Aucune requête ne quitte la page — le banc se rend sans serveur ni Jellyfin.
 */

import { LAB_EPISODE, LAB_EPISODE_ID, LAB_SEASON_ID, LAB_SERIES_ID, LAB_USER_ID } from "../../src/dev/lecteurLab/labFixtures";

const TICKS = 10_000_000;

const SEASONS = [
  { Id: LAB_SEASON_ID, Name: "Saison 1", Type: "Season", IndexNumber: 1, SeriesId: LAB_SERIES_ID },
  { Id: "lab-season-2", Name: "Saison 2", Type: "Season", IndexNumber: 2, SeriesId: LAB_SERIES_ID },
  { Id: "lab-season-3", Name: "Saison 3", Type: "Season", IndexNumber: 3, SeriesId: LAB_SERIES_ID },
];

const EPISODES = [
  { n: 1, name: "Llama Drama", seconds: 90, played: true },
  { n: 2, name: "Gran Dillama", seconds: 190, percent: 46 },
  { n: 3, name: "Llamigos", seconds: 150 },
  { n: 4, name: "Le manchot et la clôture", seconds: 204 },
].map((ep) => ({
  Id: ep.n === 2 ? LAB_EPISODE_ID : `lab-episode-${ep.n}`,
  Name: ep.name,
  Type: "Episode",
  SeriesId: LAB_SERIES_ID,
  SeriesName: "Caminandes",
  SeasonId: LAB_SEASON_ID,
  ParentIndexNumber: 1,
  IndexNumber: ep.n,
  RunTimeTicks: ep.seconds * TICKS,
  CommunityRating: 7.4 + ep.n / 10,
  UserData: { Played: !!ep.played, PlayedPercentage: ep.percent ?? 0, PlaybackPositionTicks: 0, IsFavorite: false },
}));

const SERIES = { Id: LAB_SERIES_ID, Name: "Caminandes", Type: "Series", ProviderIds: { Tmdb: "1" } };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function answer(url: URL): Response | null {
  const path = url.pathname;
  if (!path.includes("/api/")) return null;
  if (/\/Shows\/[^/]+\/Seasons/.test(path)) return json({ Items: SEASONS });
  if (/\/Shows\/[^/]+\/Episodes/.test(path)) {
    const season = url.searchParams.get("seasonId") ?? url.searchParams.get("SeasonId");
    return json({ Items: season && season !== LAB_SEASON_ID ? [] : EPISODES });
  }
  if (path.endsWith(`/Items/${LAB_SERIES_ID}`)) return json(SERIES);
  if (path.endsWith(`/Items/${LAB_EPISODE_ID}`)) return json(LAB_EPISODE);
  return json({ error: "not_found" }, 404);
}

export function installFakeServer(images: { thumbs: string[] }): void {
  localStorage.setItem("tentacle_user", JSON.stringify({ Id: LAB_USER_ID, Name: "Knaoxtest" }));
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    return answer(url) ?? real(input, init);
  };
  // Les vignettes d'épisodes : l'image du proxy Jellyfin n'existe pas — une image du banc à la place.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!descriptor?.set || !descriptor.get) return;
  const { set, get } = descriptor;
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() { return get.call(this); },
    set(value: string) {
      const match = /\/Items\/lab-episode-(\d+)\/Images/.exec(value);
      set.call(this, match ? images.thumbs[(Number(match[1]) - 1) % images.thumbs.length] : value);
    },
  });
}
