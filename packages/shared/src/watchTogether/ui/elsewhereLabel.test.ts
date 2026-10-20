import { describe, expect, it } from "vitest";
import { elsewhereLabel } from "./elsewhereLabel";

describe("elsewhereLabel", () => {
  it("dit « Votre groupe… » quand l'hôte est le compte de l'appareil", () => {
    expect(elsewhereLabel({ hostUsername: "Damien", hostUserId: "me" }, "me")).toEqual({ key: "elsewhereActiveOwn" });
  });
  it("nomme l'hôte quand c'est un autre compte", () => {
    expect(elsewhereLabel({ hostUsername: "Alice", hostUserId: "alice" }, "me"))
      .toEqual({ key: "elsewhereActiveWithHost", params: { name: "Alice" } });
  });
  it("serveur sans hostUserId : nomme l'hôte comme avant ; sans nom : la phrase neutre", () => {
    expect(elsewhereLabel({ hostUsername: "Alice" }, "me")).toEqual({ key: "elsewhereActiveWithHost", params: { name: "Alice" } });
    expect(elsewhereLabel({ hostUsername: "" }, "me")).toEqual({ key: "elsewhereActive" });
  });
});
