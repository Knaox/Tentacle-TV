import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../configStore", () => ({ getJellyfinUrl: () => "http://jellyfin.test", getJellyfinApiKey: () => "cle" }));

import { getUserAccess, markAllUserAccessStale, resetUserAccessForTests, toUserData } from "./userAccess";

describe("toUserData", () => {
  it("garde Ma liste (le « j'aime » de Jellyfin) pour que la carte d'un film trouvé montre son signet", () => {
    expect(toUserData({ Likes: true, Played: false }).Likes).toBe(true);
  });

  it("n'écrit rien quand le titre n'est pas dans Ma liste", () => {
    const data = toUserData({ Likes: false, IsFavorite: true });
    expect("Likes" in data).toBe(false);
    expect(data.IsFavorite).toBe(true);
  });
});

describe("les droits d'un compte après un ajout", () => {
  let library: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    resetUserAccessForTests();
    library = ["film-a"];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ Items: library.map((Id) => ({ Id })), TotalRecordCount: library.length }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("se relèvent en fond : la PREMIÈRE recherche d'après trouve déjà le titre arrivé", async () => {
    expect([...(await getUserAccess("u1"))!.items.keys()]).toEqual(["film-a"]);
    library = ["film-a", "film-b"];
    markAllUserAccessStale();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect([...(await getUserAccess("u1"))!.items.keys()]).toEqual(["film-a", "film-b"]);
  });

  it("un compte qui n'a jamais cherché ne coûte rien", async () => {
    markAllUserAccessStale();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).not.toHaveBeenCalled();
  });
});
