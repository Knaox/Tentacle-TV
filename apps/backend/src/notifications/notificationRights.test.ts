/**
 * Un avis écrit avant une restriction ne se lit plus si son titre est caché au
 * compte aujourd'hui ; un avis sans titre reste ; un compte libre ne coûte rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: { readable: true, restricted: true, enableAllFolders: true, blockedMediaFolders: [] as string[] },
  asked: 0,
}));

vi.mock("../services/contentPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/contentPolicy")>()),
  getContentPolicy: async () => state.policy,
}));
// Fight Club (id « fightclub », TMDB 550) est caché au compte.
vi.mock("../services/itemAccess/itemVisibility", () => ({
  isItemVisibleTo: async (_user: string, id: string) => {
    state.asked++;
    return id !== "fightclub";
  },
}));
vi.mock("../services/reco/recoRights", () => ({
  titleAllowedFor: async (_user: string, title: { tmdbId: number }) => {
    state.asked++;
    return title.tmdbId !== 550;
  },
}));

import { visibleNotificationRows } from "./notificationRights";

const row = (id: string, target: unknown) => ({ id, target: target === null ? null : JSON.stringify(target) });
const ROWS = [
  row("arrivee-fight", { kind: "item", itemId: "fightclub" }),
  row("demande-fight", { kind: "title", mediaType: "movie", tmdbId: 550 }),
  row("arrivee-toy", { kind: "item", itemId: "toystory" }),
  row("demande-nemo", { kind: "title", mediaType: "movie", tmdbId: 12, fallback: { kind: "item", itemId: "fightclub" } }),
  row("ticket", null),
  row("vigie", { kind: "extension", pluginId: "seer", path: "/requests" }),
];

beforeEach(() => {
  state.policy = { readable: true, restricted: true, enableAllFolders: true, blockedMediaFolders: [] };
  state.asked = 0;
});

describe("visibleNotificationRows", () => {
  it("un compte restreint ne lit plus les avis d'un titre caché ; les autres restent, dans l'ordre", async () => {
    expect((await visibleNotificationRows("enfant", ROWS)).map((r) => r.id)).toEqual(["arrivee-toy", "ticket", "vigie"]);
  });

  it("des bibliothèques bornées suffisent à filtrer", async () => {
    state.policy = { readable: true, restricted: false, enableAllFolders: false, blockedMediaFolders: [] };
    expect((await visibleNotificationRows("filmsseuls", ROWS)).map((r) => r.id)).toEqual(["arrivee-toy", "ticket", "vigie"]);
  });

  it("un compte libre : tout, sans aucune question", async () => {
    state.policy = { readable: true, restricted: false, enableAllFolders: true, blockedMediaFolders: [] };
    expect(await visibleNotificationRows("libre", ROWS)).toHaveLength(ROWS.length);
    expect(state.asked).toBe(0);
  });
});
