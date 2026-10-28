import { describe, expect, it } from "vitest";
import { sharedLinkSearchSteps } from "./useSharedLinkSearch";

const LINK = "https://www.shazam.com/track/20066955/kiss-the-rain";

describe("un lien Shazam collé dans la recherche (web, bureau)", () => {
  it("le collage valide le lien tel quel", () => {
    expect(sharedLinkSearchSteps({ query: "", draft: `  ${LINK} `, resolved: null })).toEqual({ paste: LINK, replaceWith: null });
  });

  it("le titre nommé remplace le lien", () => {
    expect(sharedLinkSearchSteps({ query: LINK, draft: LINK, resolved: "Kiss the Rain Billie Myers" })).toEqual({ paste: null, replaceWith: "Kiss the Rain Billie Myers" });
  });

  it("une frappe ordinaire, ou le titre déjà posé : rien", () => {
    expect(sharedLinkSearchSteps({ query: "", draft: "daft punk", resolved: null })).toEqual({ paste: null, replaceWith: null });
    expect(sharedLinkSearchSteps({ query: "Kiss the Rain", draft: "Kiss the Rain", resolved: "Kiss the Rain" })).toEqual({ paste: null, replaceWith: null });
  });
});
