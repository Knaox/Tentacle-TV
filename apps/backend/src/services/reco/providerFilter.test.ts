import { describe, expect, it } from "vitest";
import {
  PROVIDER_FILTER_MAX,
  expandFamilies,
  filterKeyOf,
  itemMatchesFilter,
  providerFilterFromQuery,
  providerIdsMatch,
} from "./providerFilter";

describe("providerFilterFromQuery", () => {
  it("accepte chaîne, tableau, « + » et « , » ; ignore l'invalide ; canonise et trie", () => {
    expect(providerFilterFromQuery("283,1968")).toEqual([283]);
    expect(providerFilterFromQuery("1968+415")).toEqual([283, 415]);
    expect(providerFilterFromQuery(["415", "8"])).toEqual([8, 415]);
    expect(providerFilterFromQuery("abc,0,-1,283,283")).toEqual([283]);
    expect(providerFilterFromQuery(2100)).toEqual([119]);
  });

  it("rien de valide → null ; au-delà de la borne, tronqué", () => {
    expect(providerFilterFromQuery(undefined)).toBeNull();
    expect(providerFilterFromQuery("")).toBeNull();
    expect(providerFilterFromQuery("x,y")).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => 10_000 + i).join(",");
    expect(providerFilterFromQuery(many)).toHaveLength(PROVIDER_FILTER_MAX);
  });
});

describe("filterKeyOf", () => {
  it("« all » sans filtre, sinon les ids canoniques joints par +", () => {
    expect(filterKeyOf(null)).toBe("all");
    expect(filterKeyOf([])).toBe("all");
    expect(filterKeyOf([415, 283])).toBe("283+415");
    expect(filterKeyOf([1968])).toBe("283");
  });
});

describe("expandFamilies", () => {
  it("élargit aux frères et aux canaux régionaux reconnus par le nom", () => {
    const wanted = expandFamilies(
      [283],
      [
        { id: 4242, name: "Crunchyroll Swisscom Channel" },
        { id: 1853, name: "Paramount Plus Apple TV channel" },
        { id: 8, name: "Netflix" },
      ]
    );
    expect([...wanted].sort((a, b) => a - b)).toEqual([283, 1968, 4242]);
  });
});

describe("filtre strict", () => {
  const wanted = new Set([283, 1968]);
  it("l'inconnu ne passe jamais, le vide non plus", () => {
    expect(providerIdsMatch(null, wanted)).toBe(false);
    expect(providerIdsMatch(undefined, wanted)).toBe(false);
    expect(providerIdsMatch([], wanted)).toBe(false);
    expect(itemMatchesFilter(null, wanted)).toBe(false);
  });
  it("un id de la famille suffit", () => {
    expect(providerIdsMatch([8, 1968], wanted)).toBe(true);
    expect(providerIdsMatch([8], wanted)).toBe(false);
    expect(itemMatchesFilter([{ id: 283 }], wanted)).toBe(true);
  });
});
