import { describe, expect, it } from "vitest";
import { routeGroupKey, shellSectionKey } from "./routeKeys";

describe("clé de groupe (autour des routes)", () => {
  it("toutes les pages de la coquille partagent une clé", () => {
    expect(routeGroupKey("/")).toBe("shell");
    expect(routeGroupKey("/favorites")).toBe("shell");
    expect(routeGroupKey("/settings/appearance")).toBe("shell");
    expect(routeGroupKey("/mon-plugin")).toBe("shell");
  });
  it("un écran immersif a la sienne, quel que soit l'élément affiché", () => {
    expect(routeGroupKey("/media/a")).toBe("media");
    expect(routeGroupKey("/media/b")).toBe("media");
    expect(routeGroupKey("/watch/a")).toBe("watch");
    expect(routeGroupKey("/offline/item/a")).toBe(routeGroupKey("/offline/series/b"));
  });
  it("une redirection pure ne sort pas de la coquille", () => {
    expect(routeGroupKey("/setup")).toBe("shell");
    expect(routeGroupKey("/preferences")).toBe("shell");
  });
});

describe("clé de section (sous la barre)", () => {
  it("la section, pas l'adresse complète", () => {
    expect(shellSectionKey("/")).toBe("");
    expect(shellSectionKey("/recommendations/refine")).toBe("recommendations");
    expect(shellSectionKey("/settings/appearance")).toBe(shellSectionKey("/settings/security"));
    expect(shellSectionKey("/admin/users")).toBe("admin");
  });
  it("chaque bibliothèque est une page", () => {
    expect(shellSectionKey("/library/a")).toBe("library/a");
    expect(shellSectionKey("/library/a")).not.toBe(shellSectionKey("/library/b"));
  });
});
