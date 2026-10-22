import { describe, expect, it } from "vitest";
import { routedPath } from "./routedPath";

describe("routedPath — le chemin que suit le routeur", () => {
  it("décode le chemin et laisse la requête de côté", () => {
    expect(routedPath("/%61pi/%70air/tv-token?x=%70")).toBe("/api/pair/tv-token");
  });

  it("rend l'URL brute quand l'encodage est illisible", () => {
    expect(routedPath("/api/genres/100%")).toBe("/api/genres/100%");
  });
});
