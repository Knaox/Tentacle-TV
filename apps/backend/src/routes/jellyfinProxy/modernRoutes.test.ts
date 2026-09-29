import { describe, expect, it } from "vitest";
import { translateLegacyRoute } from "./modernRoutes";

const U = "f12b22ea52da40ef8b8bbafcfa1df3dc";

describe("translateLegacyRoute", () => {
  it("traduit chaque route héritée vers sa forme documentée, userId en query", () => {
    const cases: Array<[string, string]> = [
      [`Users/${U}/Items`, "Items"],
      [`Users/${U}/Items/Resume`, "UserItems/Resume"],
      [`Users/${U}/Items/Latest`, "Items/Latest"],
      [`Users/${U}/Items/Root`, "Items/Root"],
      [`Users/${U}/Items/abc`, "Items/abc"],
      [`Users/${U}/Items/abc/Rating`, "UserItems/abc/Rating"],
      [`Users/${U}/Items/abc/UserData`, "UserItems/abc/UserData"],
      [`Users/${U}/Items/abc/LocalTrailers`, "Items/abc/LocalTrailers"],
      [`Users/${U}/Items/abc/SpecialFeatures`, "Items/abc/SpecialFeatures"],
      [`Users/${U}/Items/abc/Intros`, "Items/abc/Intros"],
      [`Users/${U}/Views`, "UserViews"],
      [`Users/${U}/FavoriteItems/abc`, "UserFavoriteItems/abc"],
      [`Users/${U}/PlayedItems/abc`, "UserPlayedItems/abc"],
      [`Users/${U}/Images/Primary`, "UserImage"],
    ];
    for (const [legacy, modern] of cases) {
      expect(translateLegacyRoute(legacy, ""), legacy).toEqual({ path: modern, query: `?userId=${U}` });
    }
  });

  it("garde la query du client et n'y double pas l'utilisateur", () => {
    const out = translateLegacyRoute(`Users/${U}/Items`, "?ParentId=p1&Fields=Overview,Genres&UserId=autre&Limit=5");
    const params = new URLSearchParams(out!.query.slice(1));
    expect(out!.path).toBe("Items");
    expect(params.get("ParentId")).toBe("p1");
    expect(params.get("Fields")).toBe("Overview,Genres");
    expect(params.get("Limit")).toBe("5");
    expect(params.getAll("userId")).toEqual([U]);
    expect(params.has("UserId")).toBe(false);
  });

  it("garde les paramètres répétés", () => {
    const out = translateLegacyRoute(`Users/${U}/Items`, "?ids=a&ids=b");
    expect(new URLSearchParams(out!.query.slice(1)).getAll("ids")).toEqual(["a", "b"]);
  });

  it("ignore la casse du chemin, comme la liste blanche", () => {
    expect(translateLegacyRoute(`users/${U}/views`, "")?.path).toBe("UserViews");
  });

  it("laisse partir tel quel ce qui n'est pas une route héritée", () => {
    for (const path of ["Users/Me", "Users/AuthenticateByName", "Users/Me/Items", "Items/abc", "Shows/NextUp", "UserItems/abc/UserData"]) {
      expect(translateLegacyRoute(path, "?x=1"), path).toBeNull();
    }
  });
});
