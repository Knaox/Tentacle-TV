/**
 * Les listes que Jellyfin ne borne pas aux bibliothèques du compte (banc du
 * contrôle parental, 10.11.11) : un parent refusé rend une liste vide, une
 * liste d'ids ne garde que ce que le compte voit — et un compte libre ne coûte
 * aucune question de plus.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: { readable: true, enableAllFolders: false, blockedMediaFolders: [] as string[] },
  visible: new Set<string>(["films", "toy"]),
  asked: [] as string[],
}));

vi.mock("../../middleware/auth", () => ({
  validateToken: async (token: string) =>
    token === "jeton-enfant" ? { ok: true, user: { userId: "enfant", username: "Enfant", isAdmin: false, session: "personal" } } : { ok: false, reason: "invalid" },
}));
vi.mock("../../services/contentPolicy", () => ({
  getContentPolicy: async () => state.policy,
}));
vi.mock("../../services/itemAccess/itemVisibility", () => ({
  isItemVisibleTo: async (_user: string, id: string) => {
    state.asked.push(id);
    return state.visible.has(id);
  },
  visibleItemIdsFor: async (_user: string, ids: string[]) => {
    state.asked.push(...ids);
    return ids.filter((id) => state.visible.has(id));
  },
}));

import { emptyListBody, keepVisibleItems, libraryListGuard, listScope } from "./libraryListGuard";

beforeEach(() => {
  state.policy = { readable: true, enableAllFolders: false, blockedMediaFolders: [] };
  state.asked = [];
});

describe("listScope", () => {
  it("relève le parent (toute casse) et les ids d'une liste d'Items", () => {
    expect(listScope("GET", "Items/Latest", "?parentId=reservee&Limit=20")).toEqual({ parents: ["reservee"], ids: false, userId: null });
    expect(listScope("GET", "Items", "?Ids=a,b&userId=u")).toEqual({ parents: [], ids: true, userId: "u" });
    expect(listScope("GET", "Users/u/Items", "?ids=a")).toEqual({ parents: [], ids: true, userId: "u" });
  });

  it("une série ou une saison nommée est un parent, par la query ou le chemin", () => {
    expect(listScope("GET", "Shows/NextUp", "?SeriesId=pat&userId=u")?.parents).toEqual(["pat"]);
    expect(listScope("GET", "Shows/pat/Episodes", "?SeasonId=s1")?.parents).toEqual(["pat", "s1"]);
    expect(listScope("GET", "Shows/pat/Seasons", "")?.parents).toEqual(["pat"]);
    expect(listScope("GET", "Shows/NextUp", "?userId=u")).toBeNull();
  });

  it("ignore les écritures, les requêtes sans parent ni ids et les ids hors d'une liste", () => {
    expect(listScope("POST", "Items", "?Ids=a")).toBeNull();
    expect(listScope("GET", "Items", "?Recursive=true")).toBeNull();
    expect(listScope("GET", "Items/a/Similar", "?Ids=a")).toBeNull();
  });
});

describe("libraryListGuard", () => {
  it("rend une liste VIDE quand le parent (une bibliothèque refusée) n'est pas visible", async () => {
    const guard = await libraryListGuard("GET", "Items/Latest", "?ParentId=reservee", undefined, "enfant");
    expect(guard).toEqual({ empty: "[]", filterUser: null });
    const items = await libraryListGuard("GET", "Items", "?ParentId=reservee&userId=enfant", "jeton-enfant", null);
    expect(JSON.parse(items.empty ?? "null")).toEqual({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  });

  it("rend vide les épisodes d'une série refusée", async () => {
    expect((await libraryListGuard("GET", "Shows/pat/Episodes", "?userId=enfant", "jeton-enfant", null)).empty).toContain('"Items":[]');
    expect((await libraryListGuard("GET", "Shows/NextUp", "?SeriesId=pat", undefined, "enfant")).empty).not.toBeNull();
  });

  it("laisse passer un parent visible, et demande le filtrage d'une liste d'ids", async () => {
    expect(await libraryListGuard("GET", "Items", "?ParentId=films", undefined, "enfant")).toEqual({ empty: null, filterUser: null });
    expect(await libraryListGuard("GET", "Items", "?Ids=toy,prince", "jeton-enfant", null)).toEqual({ empty: null, filterUser: "enfant" });
  });

  it("un compte sans borne de bibliothèques ne coûte aucune question à Jellyfin", async () => {
    state.policy = { readable: true, enableAllFolders: true, blockedMediaFolders: [] };
    expect(await libraryListGuard("GET", "Items", "?ParentId=reservee&Ids=prince", undefined, "libre")).toEqual({ empty: null, filterUser: null });
    expect(state.asked).toEqual([]);
  });

  it("une politique illisible vaut des bibliothèques bornées (fermé à l'échec)", async () => {
    state.policy = { readable: false, enableAllFolders: false, blockedMediaFolders: [] };
    expect((await libraryListGuard("GET", "Items", "?ParentId=reservee", undefined, "enfant")).empty).not.toBeNull();
  });

  it("le userId de la requête évite de valider le jeton (Jellyfin refuse celui d'un autre)", async () => {
    expect((await libraryListGuard("GET", "Items", "?ParentId=reservee&userId=enfant", "jeton-inconnu", null)).empty).not.toBeNull();
  });

  it("sans compte identifiable, Jellyfin décide seul", async () => {
    expect(await libraryListGuard("GET", "Items", "?ParentId=reservee", "inconnu", null)).toEqual({ empty: null, filterUser: null });
  });
});

describe("keepVisibleItems", () => {
  it("retire les titres invisibles et corrige le total", async () => {
    const body = JSON.stringify({ Items: [{ Id: "toy", Name: "Toy Story" }, { Id: "prince", Name: "Le Petit Prince" }], TotalRecordCount: 2, StartIndex: 0 });
    expect(JSON.parse(await keepVisibleItems(body, "enfant"))).toEqual({ Items: [{ Id: "toy", Name: "Toy Story" }], TotalRecordCount: 1, StartIndex: 0 });
  });

  it("rend tel quel un corps sans liste ou illisible", async () => {
    expect(await keepVisibleItems("pas du json", "enfant")).toBe("pas du json");
    expect(await keepVisibleItems('{"Name":"x"}', "enfant")).toBe('{"Name":"x"}');
  });

  it("la forme vide suit la route", () => {
    expect(emptyListBody("Items/Latest")).toBe("[]");
    expect(emptyListBody("Shows/NextUp")).toContain('"Items":[]');
  });
});
