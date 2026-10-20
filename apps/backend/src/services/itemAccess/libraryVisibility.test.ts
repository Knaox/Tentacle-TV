/**
 * Un titre gardé hors ligne avant le retrait d'un droit ne se lit plus : le
 * serveur juge chaque titre pour l'identité en session (compte, ou profil de la
 * famille ouvert sur le téléphone du parent).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  visible: new Set<string>(),
  inLibrary: new Set<string>(),
  policy: { readable: true, restricted: false, limits: false },
  listOk: true,
  listCalls: 0,
}));

vi.mock("./itemVisibility", () => ({
  visibleItemIdsFor: async (_userId: string, ids: readonly string[]) => ids.filter((id) => h.visible.has(id)),
}));
vi.mock("../contentPolicy", () => ({
  getContentPolicy: async () => ({ readable: h.policy.readable, restricted: h.policy.restricted }),
  limitsLibraries: () => h.policy.limits,
}));
vi.mock("../jellyfinLibrary", () => ({ adminUserParam: async () => "&userId=admin" }));
vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string) => {
    h.listCalls++;
    if (!h.listOk) return { ok: false, failure: "unreachable" };
    const ids = decodeURIComponent(/Ids=([^&]+)/.exec(path)?.[1] ?? "").split(",");
    return { ok: true, data: { Items: ids.filter((id) => h.inLibrary.has(id)).map((Id) => ({ Id: Id.toUpperCase() })) } };
  },
}));

import { libraryVisibilityFor } from "./libraryVisibility";

const TOY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PULP = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GONE = "cccccccccccccccccccccccccccccccc";

beforeEach(() => {
  h.visible = new Set([TOY]);
  h.inLibrary = new Set([TOY, PULP]);
  h.policy = { readable: true, restricted: false, limits: false };
  h.listOk = true;
  h.listCalls = 0;
});

describe("libraryVisibilityFor", () => {
  it("tout visible : aucune autre question", async () => {
    expect(await libraryVisibilityFor("u", [TOY])).toEqual({ visible: [TOY], hidden: [], gone: [] });
    expect(h.listCalls).toBe(0);
  });

  it("identité sans restriction : caché si encore dans la bibliothèque, disparu sinon (lisible comme avant)", async () => {
    expect(await libraryVisibilityFor("u", [TOY, PULP, GONE])).toEqual({ visible: [TOY], hidden: [PULP], gone: [GONE] });
  });

  it("identité restreinte (profil d'un enfant) : un titre disparu ne peut plus être jugé — caché", async () => {
    h.policy.restricted = true;
    expect(await libraryVisibilityFor("enfant", [TOY, PULP, GONE])).toEqual({ visible: [TOY], hidden: [PULP, GONE], gone: [] });
    expect(h.listCalls).toBe(0);
  });

  it("bibliothèques bornées par la famille, ou politique illisible : fermé à l'échec", async () => {
    h.policy.limits = true;
    expect((await libraryVisibilityFor("g", [GONE])).hidden).toEqual([GONE]);
    h.policy = { readable: false, restricted: false, limits: false };
    expect((await libraryVisibilityFor("g", [GONE])).hidden).toEqual([GONE]);
  });

  it("Jellyfin muet sur la liste : tout ce qui n'est pas visible est caché", async () => {
    h.listOk = false;
    expect(await libraryVisibilityFor("u", [TOY, GONE])).toEqual({ visible: [TOY], hidden: [GONE], gone: [] });
  });
});
