import { describe, expect, it } from "vitest";
import { isSegmentTimeout } from "./segmentTimeout";

describe("isSegmentTimeout — un segment qui tarde", () => {
  it("la trace relevée au simulateur (transcodage à ×0,3, premier segment à 40 s)", () => {
    expect(isSegmentTimeout("The operation couldn’t be completed. (CoreMediaErrorDomain error -12889.)")).toBe(true);
  });

  it("un délai réseau dépassé, par son code ou par son texte", () => {
    expect(isSegmentTimeout("The request timed out.")).toBe(true);
    expect(isSegmentTimeout("NSURLErrorDomain error -1001")).toBe(true);
  });

  it("ni une connexion refusée, ni un format, ni un code voisin", () => {
    expect(isSegmentTimeout("Could not connect to the server. (NSURLErrorDomain error -1004.)")).toBe(false);
    expect(isSegmentTimeout("Could not open: Cannot Decode")).toBe(false);
    expect(isSegmentTimeout("CoreMediaErrorDomain error -128890")).toBe(false);
    expect(isSegmentTimeout("http=401")).toBe(false);
  });
});
