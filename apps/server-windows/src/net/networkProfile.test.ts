import { describe, expect, it } from "vitest";
import { isPublic, parseProfiles } from "./networkProfile";

describe("profils réseau", () => {
  it("lit un objet seul comme un tableau, en texte ou en nombre", () => {
    expect(parseProfiles('{"InterfaceAlias":"Wi-Fi","NetworkCategory":0}')).toEqual([{ alias: "Wi-Fi", category: "Public" }]);
    expect(parseProfiles('[{"InterfaceAlias":"Ethernet","NetworkCategory":"Private"},{"InterfaceAlias":"vEthernet","NetworkCategory":1}]')).toEqual([
      { alias: "Ethernet", category: "Private" },
      { alias: "vEthernet", category: "Private" },
    ]);
    expect(parseProfiles("")).toEqual([]);
  });

  it("juge la carte de notre adresse, ou la seule connue", () => {
    const profiles = [
      { alias: "Ethernet", category: "Private" },
      { alias: "Wi-Fi", category: "Public" },
    ];
    expect(isPublic(profiles, "Wi-Fi")).toBe(true);
    expect(isPublic(profiles, "Ethernet")).toBe(false);
    expect(isPublic(profiles, null)).toBe(false);
    expect(isPublic([{ alias: "Wi-Fi", category: "Public" }], null)).toBe(true);
  });
});
