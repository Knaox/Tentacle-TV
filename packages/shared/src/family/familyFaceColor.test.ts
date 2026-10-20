import { describe, expect, it } from "vitest";
import { faceColorOf, overviewColorOf, personalColorOf } from "./familyFaceColor";

const listing = {
  pickerRequired: true,
  profiles: [
    { userId: "damien", personal: true, color: "red" as const },
    { userId: "leo", personal: false, color: "teal" as const },
  ],
} as never;
const overview = { family: { profiles: [{ userId: "damien", color: "red" }, { userId: "leo", color: "teal" }] } } as never;

describe("la couleur d'un profil sans photo, la même partout", () => {
  it("en session de profil : la sienne", () => {
    expect(faceColorOf({ activeColor: "teal", listing, overview, accountId: "damien" })).toBe("teal");
  });
  it("en session personnelle dans une famille : celle du compte, de « Qui regarde ? » sinon de la Famille", () => {
    expect(faceColorOf({ activeColor: null, listing, overview, accountId: "damien" })).toBe("red");
    expect(faceColorOf({ activeColor: null, listing: null, overview, accountId: "da-mi-en" })).toBe("red");
  });
  it("sans famille (ou seul), ou serveur d'avant : le dégradé de marque (null)", () => {
    expect(personalColorOf({ pickerRequired: false, profiles: [] })).toBeNull();
    expect(overviewColorOf({ family: null }, "damien")).toBeNull();
    expect(overviewColorOf({ family: { profiles: [{ userId: "damien", color: "red" }] } } as never, "damien")).toBeNull();
    expect(faceColorOf({ activeColor: null, accountId: null })).toBeNull();
  });
});
