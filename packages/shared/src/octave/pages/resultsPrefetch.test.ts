import { describe, expect, it } from "vitest";
import { resultsToAnnounce } from "./resultsPrefetch";

const base = { query: "daft punk", stableQuery: "daft punk", provisional: false, ids: ["a", "b", "c", "d"], announced: null };

describe("annonce des premiers résultats à l'extension", () => {
  it("page sûre, requête stable : les trois premiers, une fois", () => {
    expect(resultsToAnnounce(base)).toEqual(["a", "b", "c"]);
    expect(resultsToAnnounce({ ...base, announced: "daft punk" })).toBeNull();
  });

  it("jamais une page provisoire", () => {
    expect(resultsToAnnounce({ ...base, provisional: true })).toBeNull();
  });

  it("jamais une requête encore en frappe (pas stable depuis 700 ms)", () => {
    expect(resultsToAnnounce({ ...base, query: "daft punk g", stableQuery: "daft punk" })).toBeNull();
  });

  it("rien à annoncer sans titre ni requête", () => {
    expect(resultsToAnnounce({ ...base, ids: [] })).toBeNull();
    expect(resultsToAnnounce({ ...base, query: " ", stableQuery: " " })).toBeNull();
  });
});
