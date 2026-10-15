/**
 * Les statistiques face aux droits d'aujourd'hui : un titre regardé ou aimé
 * avant d'être caché au compte ne revient plus — nom compris —, un titre
 * supprimé depuis garde sa place, et un compte libre ne coûte rien de plus.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasuredHistory } from "./measuredHistory";
import type { ViewingStatsTaste, ViewingStatsTasteTitle } from "./contract";

const state = vi.hoisted(() => ({
  policy: { readable: true, restricted: true, enableAllFolders: true, blockedMediaFolders: [] as string[] },
  rights: { hidesItem: (id: string) => id === "fightclub" } as null | { hidesItem(id: string): boolean },
}));

vi.mock("../contentPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../contentPolicy")>()),
  getContentPolicy: async () => state.policy,
}));
vi.mock("../search/libraryRights", () => ({ libraryRightsFor: async () => state.rights }));
// Fight Club (550) est caché au compte ; tout le reste passe.
vi.mock("../reco/recoRights", () => ({
  filterByRights: async (_user: string, items: Array<{ tmdbId: number }>) => items.filter((item) => item.tmdbId !== 550),
}));

import { statsRightsFor } from "./statsRights";

const entry = (titleId: string) => ({
  titleId, itemId: titleId, kind: "movie" as const, client: null, seconds: 600, runtimeSeconds: null, audioLang: null, startedAt: 0, lastSeenAt: 0,
});
const history = (): MeasuredHistory => ({
  entries: [entry("fightclub"), entry("toystory"), entry("supprime")],
  movieNames: new Map([["fightclub", "Fight Club"], ["toystory", "Toy Story"], ["supprime", "Un film supprimé"]]),
  seriesNames: new Map(),
});
const loved = (tmdbId: number, title: string): ViewingStatsTasteTitle => ({
  key: `movie:${tmdbId}`, mediaType: "movie", tmdbId, title, jellyfinId: null, posterPath: null, reasons: [], rating: null, hours: 2,
});
const taste = (): ViewingStatsTaste => ({
  available: true, computedAt: null, animeShare: 0, loved: [loved(550, "Fight Club"), loved(862, "Toy Story")],
  signals: { ratings: 0, ratingAverage: null, superlikes: 0, likes: 0, dislikes: 0, likedPeople: 0, favorites: 0 },
  potential: { count: 2, titles: [loved(550, "Fight Club"), loved(12, "Le Monde de Nemo")] },
});

beforeEach(() => {
  state.policy = { readable: true, restricted: true, enableAllFolders: true, blockedMediaFolders: [] };
  state.rights = { hidesItem: (id) => id === "fightclub" };
});

describe("statsRightsFor", () => {
  it("un compte libre : rien à filtrer", async () => {
    state.policy = { readable: true, restricted: false, enableAllFolders: true, blockedMediaFolders: [] };
    expect(await statsRightsFor("libre")).toBeNull();
  });

  it("une séance d'un titre caché ne compte plus, nom compris ; un titre supprimé garde sa place", async () => {
    const rights = await statsRightsFor("enfant");
    const kept = rights!.measured(history());
    expect(kept.entries.map((e) => e.titleId)).toEqual(["toystory", "supprime"]);
    expect([...kept.movieNames.values()]).toEqual(["Toy Story", "Un film supprimé"]);
  });

  it("des bibliothèques bornées suffisent (sans note maximale)", async () => {
    state.policy = { readable: true, restricted: false, enableAllFolders: false, blockedMediaFolders: [] };
    expect((await statsRightsFor("filmsseuls"))!.measured(history()).entries).toHaveLength(2);
  });

  it("droits illisibles : les séances mesurées partent (fermé à l'échec)", async () => {
    state.rights = null;
    expect((await statsRightsFor("enfant"))!.measured(history()).entries).toEqual([]);
  });

  it("le goût : un titre aimé ou gardé avant d'être caché disparaît", async () => {
    const filtered = await (await statsRightsFor("enfant"))!.taste(taste());
    expect(filtered.loved.map((t) => t.title)).toEqual(["Toy Story"]);
    expect(filtered.potential?.titles.map((t) => t.title)).toEqual(["Le Monde de Nemo"]);
  });
});
