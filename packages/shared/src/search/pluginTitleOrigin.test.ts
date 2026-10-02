import { describe, expect, it } from "vitest";
import { isTitleOrigin, titleRequestBody } from "./pluginTitleOrigin";

describe("l'origine d'une demande dans le contrat titles", () => {
  it("part avec la demande quand le client la dit", () => {
    const body = JSON.parse(titleRequestBody({ mediaType: "movie", tmdbId: 603, lang: "fr" }, { origin: "tv", platform: "appletv" }));
    expect(body).toEqual({ mediaType: "movie", tmdbId: 603, lang: "fr", origin: "tv", platform: "appletv" });
  });

  it("ne change rien au corps d'un client qui ne la dit pas (web, mobile)", () => {
    const fields = { mediaType: "tv", tmdbId: 1399, lang: "en", seasons: [1, 2] };
    expect(titleRequestBody(fields)).toBe(JSON.stringify(fields));
    expect(titleRequestBody(fields, null)).toBe(JSON.stringify(fields));
  });

  it("ne reconnaît que les origines connues", () => {
    expect(isTitleOrigin("tv")).toBe(true);
    for (const value of ["TV", "web", "", null, undefined, 1]) expect(isTitleOrigin(value)).toBe(false);
  });
});
