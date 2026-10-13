import { describe, expect, it } from "vitest";
import { scopedToDeviceUser } from "./deviceUserScope";

const ZOE = "dc5b778d4918499fab578837e4aff396";

describe("une requête sans utilisateur, bornée à celui de la session de profil", () => {
  it.each([
    ["Items", "?Recursive=true&IncludeItemTypes=Movie"],
    ["Items/abc", ""],
    ["items/abc/PlaybackInfo", "?MediaSourceId=x"],
    ["Items/abc/Similar", "?Limit=24"],
    ["Items/Filters2", "?parentId=x"],
    ["UserItems/Resume", "?Limit=12"],
    ["Shows/NextUp", "?Limit=12"],
    ["Shows/serie/Episodes", "?SeasonId=s"],
    ["Search/Hints", "?searchTerm=bunny"],
    ["Genres", ""],
    ["Persons/Tom%20Hanks", ""],
  ])("%s%s : le compte de la session est posé", (path, query) => {
    const scoped = scopedToDeviceUser(path, query, ZOE);
    const params = new URLSearchParams(scoped.slice(1));
    expect(params.get("userId")).toBe(ZOE);
    // La query d'origine est gardée telle quelle, devant.
    if (query) expect(scoped.startsWith(query)).toBe(true);
  });

  it("un `userId` présent (déjà jugé par le garde de périmètre) ne change rien, quelle qu'en soit la casse", () => {
    expect(scopedToDeviceUser("Items", `?UserId=${ZOE}&Limit=3`, ZOE)).toBe(`?UserId=${ZOE}&Limit=3`);
    expect(scopedToDeviceUser("Shows/NextUp", `?userid=${ZOE}`, ZOE)).toBe(`?userid=${ZOE}`);
  });

  it("ne touche ni aux flux, ni aux images, ni aux reports, ni aux écritures de ses données", () => {
    for (const path of [
      "Videos/abc/stream",
      "Videos/abc/master.m3u8",
      "videos/abc/hls1/main/0.ts",
      "Items/abc/Images/Primary",
      "Sessions/Playing",
      "UserItems/abc/UserData",
      "UserFavoriteItems/abc",
      "System/Info/Public",
      "MediaSegments/abc",
    ]) {
      expect(scopedToDeviceUser(path, "?x=1", ZOE), path).toBe("?x=1");
    }
  });

  it("une query vide ou réduite à « ? » reçoit le seul compte", () => {
    expect(scopedToDeviceUser("Items", "", ZOE)).toBe(`?userId=${ZOE}`);
    expect(scopedToDeviceUser("Items", "?", ZOE)).toBe(`?userId=${ZOE}`);
  });
});
