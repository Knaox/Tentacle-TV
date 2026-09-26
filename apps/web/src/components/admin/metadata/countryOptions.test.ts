/**
 * La liste du sélecteur de région : les pays que TMDB couvre quand on le
 * sait, tous sinon, la région enregistrée toujours ; triés par nom dans la
 * langue de l'interface ; retrouvés par code, nom local ou nom anglais.
 */

import { describe, expect, it } from "vitest";
import { buildCountryOptions, filterCountryOptions } from "./countryOptions";

const REGIONS = [
  { code: "FR", providers: 102 },
  { code: "DE", providers: 88 },
  { code: "BE", providers: 61 },
  { code: "US", providers: 190 },
];

describe("buildCountryOptions", () => {
  it("couverture connue : ces pays seulement, nommés et triés en français", () => {
    const options = buildCountryOptions(REGIONS, "fr", "FR");
    expect(options.map((o) => o.name)).toEqual(["Allemagne", "Belgique", "États-Unis", "France"]);
    expect(options.find((o) => o.code === "DE")).toEqual({ code: "DE", name: "Allemagne", englishName: "Germany", providers: 88 });
  });

  it("la région enregistrée reste proposée même si TMDB ne la couvre pas", () => {
    const options = buildCountryOptions(REGIONS, "fr", "CN");
    expect(options.find((o) => o.code === "CN")).toMatchObject({ name: "Chine", providers: 0 });
  });

  it("couverture inconnue : tous les pays, sans compte de plateformes", () => {
    const options = buildCountryOptions([], "en", "FR");
    expect(options.length).toBeGreaterThan(200);
    expect(options.every((o) => /^[A-Z]{2}$/.test(o.code) && o.providers === null)).toBe(true);
    expect(options.some((o) => o.code === "EU")).toBe(false);
  });
});

describe("filterCountryOptions", () => {
  const options = buildCountryOptions(REGIONS, "fr", "FR");

  it("vide : toute la liste", () => {
    expect(filterCountryOptions(options, "  ")).toHaveLength(4);
  });

  it("par nom local, sans accents ni casse", () => {
    expect(filterCountryOptions(options, "etats").map((o) => o.code)).toEqual(["US"]);
    expect(filterCountryOptions(options, "BELG").map((o) => o.code)).toEqual(["BE"]);
  });

  it("par nom anglais, dans une interface française", () => {
    expect(filterCountryOptions(options, "germany").map((o) => o.code)).toEqual(["DE"]);
  });

  it("le code exact passe en tête", () => {
    expect(filterCountryOptions(options, "fr")[0].code).toBe("FR");
    expect(filterCountryOptions(options, "de")[0].code).toBe("DE");
  });

  it("rien ne correspond : liste vide", () => {
    expect(filterCountryOptions(options, "atlantide")).toEqual([]);
  });
});
