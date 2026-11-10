import { beforeEach, describe, expect, it } from "vitest";

import {
  hasPageEntered,
  markPageEntered,
  pageEntranceId,
  PAGE_ENTRANCE_MEMORY_MAX,
  resetPageEntranceMemoryForTests,
} from "./pageEntranceMemory";

describe("la mémoire des entrées de page", () => {
  beforeEach(resetPageEntranceMemoryForTests);

  it("une page jamais vue n'est pas entrée ; marquée, elle l'est", () => {
    const home = pageEntranceId({ pathname: "/", search: "" });
    expect(hasPageEntered(home)).toBe(false);
    markPageEntered(home);
    expect(hasPageEntered(home)).toBe(true);
  });

  it("la requête fait une autre page : une bibliothèque filtrée entre à son tour", () => {
    markPageEntered(pageEntranceId({ pathname: "/library/a", search: "" }));
    expect(hasPageEntered(pageEntranceId({ pathname: "/library/a", search: "?genre=Drame" }))).toBe(false);
  });

  it("hors routeur (aucune adresse), rien n'est retenu", () => {
    expect(pageEntranceId(null)).toBeUndefined();
    markPageEntered(undefined);
    expect(hasPageEntered(undefined)).toBe(false);
  });

  it("bornée : la plus ancienne sort, une page revue redevient la plus récente", () => {
    markPageEntered("/premiere");
    for (let i = 0; i < PAGE_ENTRANCE_MEMORY_MAX - 1; i += 1) markPageEntered(`/page/${i}`);
    markPageEntered("/premiere");
    markPageEntered("/de-trop");
    expect(hasPageEntered("/premiere")).toBe(true);
    expect(hasPageEntered("/page/0")).toBe(false);
  });
});
