import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La saga TMDB : normalisée (volets triés, l'illisible écarté), servie de la
 * mémoire puis du disque, et jamais perdue quand TMDB se tait.
 */

const h = vi.hoisted(() => ({
  configured: true,
  fetch: vi.fn(),
  disk: new Map<string, unknown>(),
}));

vi.mock("./client", () => ({
  tmdbConfigured: () => h.configured,
  tmdbFetch: h.fetch,
}));
vi.mock("../globalCacheStore", () => ({
  readGlobalCache: async (key: string) => (h.disk.has(key) ? { payload: h.disk.get(key) } : null),
  writeGlobalCache: async (key: string, payload: unknown) => { h.disk.set(key, payload); },
}));

import { getSagaCollection, normalizeSagaCollection, resetSagaCollectionsForTests } from "./sagaCollection";

const RAW = {
  id: 1241,
  name: "Harry Potter - Saga",
  parts: [
    { id: 671, title: "Harry Potter à l'école des sorciers", release_date: "2001-11-16" },
    { id: 674, title: "Harry Potter et la Coupe de feu", release_date: "2005-11-16" },
    { id: 673, title: "Harry Potter et le Prisonnier d'Azkaban", release_date: "2004-05-31" },
  ],
};

beforeEach(() => {
  resetSagaCollectionsForTests();
  h.configured = true;
  h.fetch.mockReset();
  h.disk.clear();
});

describe("normalizeSagaCollection", () => {
  it("garde le nom et range les volets par date de sortie", () => {
    const saga = normalizeSagaCollection(RAW, 1241);
    expect(saga?.name).toBe("Harry Potter - Saga");
    expect(saga?.parts.map((p) => p.tmdbId)).toEqual([671, 673, 674]);
  });

  it("écarte l'illisible : sans identifiant, sans titre, doublon ; une date bizarre vaut « annoncé »", () => {
    const saga = normalizeSagaCollection({
      name: "28… plus tard - Saga",
      parts: [
        { id: 170, title: "28 Jours plus tard", release_date: "2002-10-31" },
        { id: "x", title: "Sans identifiant" },
        { id: 12, title: "  " },
        { id: 170, title: "Doublon", release_date: "2002-10-31" },
        { id: 1273002, title: "28 ans plus tard III", release_date: "" },
        null,
      ],
    }, 1565);
    expect(saga?.parts).toEqual([
      { tmdbId: 170, title: "28 Jours plus tard", releaseDate: "2002-10-31" },
      { tmdbId: 1273002, title: "28 ans plus tard III", releaseDate: null },
    ]);
  });

  it("sans nom ou sans liste de volets : rien", () => {
    expect(normalizeSagaCollection({ parts: [] }, 1)).toBeNull();
    expect(normalizeSagaCollection({ name: "X" }, 1)).toBeNull();
    expect(normalizeSagaCollection(null, 1)).toBeNull();
  });
});

describe("getSagaCollection", () => {
  it("demande TMDB dans la langue de l'interface, puis sert la mémoire", async () => {
    h.fetch.mockResolvedValue(RAW);
    expect((await getSagaCollection(1241, "fr"))?.name).toBe("Harry Potter - Saga");
    await getSagaCollection(1241, "fr");
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch).toHaveBeenCalledWith("/collection/1241", { language: "fr-FR" }, { priority: "interactive" });
  });

  it("une langue, une entrée : l'anglais est demandé à part", async () => {
    h.fetch.mockResolvedValue({ ...RAW, name: "Harry Potter Collection" });
    expect((await getSagaCollection(1241, "en"))?.name).toBe("Harry Potter Collection");
    expect(h.fetch).toHaveBeenCalledWith("/collection/1241", { language: "en-US" }, { priority: "interactive" });
  });

  it("TMDB muet : la copie du disque, même périmée, plutôt que rien", async () => {
    h.disk.set("tmdbSaga:1241:fr", { saga: normalizeSagaCollection(RAW, 1241), fetchedAt: "2020-01-01T00:00:00.000Z" });
    h.fetch.mockRejectedValue(new Error("réseau"));
    expect((await getSagaCollection(1241, "fr"))?.parts).toHaveLength(3);
  });

  it("sans clé TMDB et sans copie : null, sans appel", async () => {
    h.configured = false;
    expect(await getSagaCollection(1241, "fr")).toBeNull();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("une saga inconnue de TMDB (404) n'est pas redemandée tout de suite", async () => {
    h.fetch.mockRejectedValue(Object.assign(new Error("TMDB 404"), { status: 404 }));
    expect(await getSagaCollection(99, "fr")).toBeNull();
    expect(await getSagaCollection(99, "fr")).toBeNull();
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });
});
