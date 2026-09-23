import { beforeEach, describe, expect, it, vi } from "vitest";
import { PEOPLE, sampleCatalog } from "../../../test/searchCatalog";
import { SearchEngine } from "./engine";
import type { UserAccess } from "./userAccess";

/**
 * Le service, de la requête à la réponse rangée : ce qui se garde, c'est le
 * MEILLEUR résultat juste (le titre ou la personne), les droits du compte
 * appliqués partout — titres ET personnes —, et le repli tant que l'index
 * n'existe pas.
 */

const catalog = sampleCatalog();
const secretId = catalog.find((i) => i.name === "Film secret")?.id ?? "";

const h = vi.hoisted(() => ({
  engine: null as unknown,
  access: null as UserAccess | null,
  fallback: vi.fn(),
}));

vi.mock("./catalog", () => ({ currentEngine: () => h.engine }));
vi.mock("./userAccess", () => ({ getUserAccess: () => Promise.resolve(h.access) }));
vi.mock("./jellyfinSearch", () => ({ fallbackItems: h.fallback }));

import { runSearch } from "./searchService";

function accessWithout(hiddenIds: string[]): UserAccess {
  const items = new Map();
  for (const item of catalog) {
    if (hiddenIds.includes(item.id)) continue;
    items.set(item.id, { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false });
  }
  return { at: Date.now(), items };
}

beforeEach(() => {
  h.engine = new SearchEngine(catalog);
  h.access = accessWithout([secretId]);
  h.fallback.mockReset();
});

describe("runSearch", () => {
  it("« tom hanks » : la personne en tête, ses films dessous, avec la raison", async () => {
    const res = await runSearch("u", "tom hanks", 6);
    expect(res.top).toMatchObject({ kind: "person", hit: { id: PEOPLE.hanks.id, name: "Tom Hanks", count: 2 } });
    expect(res.movies.map((m) => m.item.Name)).toEqual(expect.arrayContaining(["Forrest Gump", "Cast Away"]));
    expect(res.movies[0]?.match).toMatchObject({ field: "people", value: "Tom Hanks" });
  });

  it("« forrest » : le titre en tête, et il n'est pas répété dans sa liste", async () => {
    const res = await runSearch("u", "forrest", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "Forrest Gump" } } });
    expect(res.movies.some((m) => m.item.Name === "Forrest Gump")).toBe(false);
    expect(res.totals.movies).toBe(1);
  });

  it("une année citée départage deux titres homonymes", async () => {
    const res = await runSearch("u", "dune 2021", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "Dune", ProductionYear: 2021 } } });
  });

  it("un titre invisible au compte n'existe pas — ni lui, ni les personnes qui n'y figurent qu'à lui", async () => {
    // « film » est un indice de type : « secret » trouve légitimement la
    // Chambre des secrets — mais jamais le titre que le compte ne voit pas.
    const res = await runSearch("u", "film secret", 6);
    const names = [res.top?.kind === "item" ? res.top.hit.item.Name : "", ...res.movies.map((m) => m.item.Name)];
    expect(names).not.toContain("Film secret");
    const person = await runSearch("u", "personne secrete", 6);
    expect(person.people).toEqual([]);
    expect(person.top?.kind === "person").toBe(false);
  });

  it("propose l'orthographe, et trouve quand même", async () => {
    const res = await runSearch("u", "hary poter", 6);
    expect(res.correction).toBe("harry potter");
    expect(res.top?.kind).toBe("item");
  });

  it("deux lettres inversées : la passe large rattrape « frorest gump »", async () => {
    const res = await runSearch("u", "frorest gump", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "Forrest Gump" } } });
  });

  it("une série trouvée par son titre, mot vide compris", async () => {
    const res = await runSearch("u", "the office", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "The Office", Type: "Series" } } });
  });

  it("des genres en pastilles, comptés pour le compte — et pas de « meilleur résultat » par le genre", async () => {
    const res = await runSearch("u", "drame", 6);
    expect(res.genres).toEqual([{ name: "Drame", count: 6 }]);
    expect(res.top).toBeNull();
  });

  it("la série couvre tout son titre : elle passe devant El Camino", async () => {
    const res = await runSearch("u", "breking bad", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "Breaking Bad" } } });
    expect(res.correction).toBe("breaking bad");
  });

  it("un nom mal tapé : la recherche se refait sur l'orthographe proche", async () => {
    const res = await runSearch("u", "tom hansk", 6);
    expect(res.correction).toBe("tom hanks");
    expect(res.query).toBe("tom hansk");
    expect(res.top).toMatchObject({ kind: "person", hit: { name: "Tom Hanks" } });
    expect(res.totals.movies).toBe(2);
  });

  it("un titre exact écarte les titres à une faute : « dune » ne propose pas la Lune", async () => {
    const res = await runSearch("u", "dune", 6);
    const names = [res.top?.kind === "item" ? res.top.hit.item.Name : "", ...res.movies.map((m) => m.item.Name)];
    expect(names).not.toContain("First Man - Le Premier Homme sur la Lune");
    expect(res.correction).toBeNull();
  });

  it("une particule détachée se recolle : « leonardo di caprio »", async () => {
    const res = await runSearch("u", "leonardo di caprio", 6);
    expect(res.correction).toBe("leonardo dicaprio");
    expect(res.top).toMatchObject({ kind: "person", hit: { name: "Leonardo DiCaprio" } });
  });

  it("un nom en deux mots se trouve soudé : « deniro »", async () => {
    const res = await runSearch("u", "deniro", 6);
    expect(res.top).toMatchObject({ kind: "person", hit: { name: "Robert De Niro" } });
  });

  it("un studio trouvé sans faute écarte une personne trouvée avec : « pixar »", async () => {
    const res = await runSearch("u", "pixar", 6);
    expect(res.people).toEqual([]);
    expect(res.top).toBeNull();
    expect(res.correction).toBeNull();
    expect(res.movies[0]?.match).toEqual({ field: "studio", value: "Pixar" });
  });

  it("un studio se replie en pastille quand un titre répond : « dune »", async () => {
    const res = await runSearch("u", "dune", 6);
    expect(res.movies.map((m) => m.item.Name)).not.toContain("Avatar");
    expect(res.studios).toEqual([{ name: "Dune Entertainment", count: 1 }]);
  });

  it("une faute garde la première lettre : « the ofice » → The Office", async () => {
    const res = await runSearch("u", "the ofice", 6);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "The Office" } } });
    expect(res.correction).toBe("the office");
  });

  it("un préfixe de deux lettres ne compte que dans le titre : « sci fi »", async () => {
    const res = await runSearch("u", "sci fi", 6);
    expect(res.movies.map((m) => m.item.Name)).not.toContain("Backrooms");
    expect(res.genres.map((g) => g.name)).toContain("Science-Fiction");
  });

  it("rien de cohérent : rien, plutôt que du bruit", async () => {
    const res = await runSearch("u", "star wars", 6);
    expect(res.top).toBeNull();
    expect(res.totals.movies + res.totals.series).toBe(0);
    expect(res.correction).toBeNull();
  });

  it("sans index : le repli de Jellyfin, dans la même forme", async () => {
    h.engine = null;
    h.fallback.mockResolvedValue([{ Id: "x", Name: "Alien", Type: "Movie" }]);
    const res = await runSearch("u", "alien", 6);
    expect(res.ready).toBe(false);
    expect(res.top).toMatchObject({ kind: "item", hit: { item: { Name: "Alien" } } });
  });

  it("une requête vide ne cherche rien", async () => {
    const res = await runSearch("u", "   ", 6);
    expect(res.top).toBeNull();
    expect(h.fallback).not.toHaveBeenCalled();
  });
});
