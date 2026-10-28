import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { artworkUrlsOf, preconnectOrigins, warmArtworkList } from "./artworkWarm";
import { attachOctaveCache, hydrateOctaveCache, type OctaveQueryClientLike } from "./octaveCachePersister";
import { anchoredKey, ENTITY_MAX_AGE_MS, entryId, evictionPlan, expired, persistable, persistKindOf, SEARCH_MAX_AGE_MS, type StoredEntry } from "./octaveCachePolicy";
import { memoryBackend } from "./octaveCacheStore";

const OWNER = "http://srv|user-1";
const SEARCH_KEY = ["music", "external-search", "sillon", "music/search", "thunder", 20];
const ALBUM_KEY = ["music", "external", "album", "ext:sillon:ytm:al:MPREb_x"];
const page = (over: Record<string, unknown> = {}) => ({ query: "thunder", complete: true, cursor: null, tracks: [{ key: "t1", artworkUrl: "https://lh3/a" }], albums: [], artists: [], ...over });
const search = (...pages: unknown[]) => ({ pages, pageParams: pages.map(() => null) });

function entry(id: unknown[], over: Partial<StoredEntry> = {}): StoredEntry {
  return { id: JSON.stringify(id), owner: OWNER, kind: "search", data: search(page()), savedAt: 1_000, usedAt: 1_000, bytes: 100, ...over };
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } }) as unknown as OctaveQueryClientLike & QueryClient;

describe("politique du cache gardé d'Octave", () => {
  it("garde les pages de l'extension et celles de la bibliothèque — tri des listes compris —, sous « music »", () => {
    expect(persistKindOf(SEARCH_KEY)).toBe("search");
    expect(persistKindOf(ALBUM_KEY)).toBe("entity");
    for (const key of [["music", "home"], ["music", "status"], ["music", "playlists"], ["music", "playlist", "p"], ["music", "album", "a"], ["music", "artist", "r"], ["music", "albums", "recent", 60], ["music", "artists", 60], ["music", "liked", 500], ["music", "list-prefs", "playlist:p"]]) {
      expect(persistKindOf(key)).toBe("library");
    }
    // Ni les sources (signées, éphémères), ni les rapprochements, ni la recherche de la bibliothèque, ni Tentacle.
    for (const key of [["music", "source", "t"], ["music", "match", "x"], ["music", "by-mbid", "x"], ["music", "search", "q", 20], ["music", "external-suggest", "x"], ["resume-items"]]) {
      expect(persistKindOf(key)).toBeNull();
    }
  });

  it("les playlists gardent leur dernier affichage en ligne : ancrées, sans âge limite, évincées en dernier", () => {
    expect(persistKindOf(["music", "pending", "sillon"])).toBe("library");
    for (const key of [["music", "playlist", "p"], ["music", "playlists"], ["music", "liked", 500], ["music", "pending", "sillon"], ["music", "list-prefs", "playlist:p"], ["music", "list-prefs", "liked"]]) {
      expect(anchoredKey(JSON.stringify(key))).toBe(true);
    }
    for (const key of [["music", "home"], ["music", "album", "a"], ["music", "list-prefs", "album:a"]]) expect(anchoredKey(JSON.stringify(key))).toBe(false);
    const old = 1_000 + 365 * 24 * 3_600_000;
    expect(expired(entry(["music", "playlist", "p"], { kind: "library" }), old)).toBe(false);
    expect(expired(entry(["music", "album", "a"], { kind: "library" }), old)).toBe(true);
    // La place manque : la page d'album part, la playlist (moins récente) reste.
    const playlist = entry(["music", "playlist", "p"], { kind: "library", usedAt: 1 });
    const album = entry(["music", "album", "a"], { kind: "library", usedAt: 9 });
    expect(evictionPlan([playlist, album], OWNER, 2_000, 1)).toEqual([album.id]);
  });

  it("une recherche se garde FINIE et jamais provisoire", () => {
    expect(persistable("search", search(page()))).toBe(true);
    expect(persistable("search", search(page({ complete: false, cursor: "c" })))).toBe(false);
    expect(persistable("search", search(page({ provisional: true, complete: false }), page()))).toBe(false);
    expect(persistable("entity", null)).toBe(false);
    expect(persistable("entity", { key: "a" })).toBe(true);
  });

  it("évince les expirées, puis les moins récemment utilisées, identité par identité", () => {
    const now = 10 * ENTITY_MAX_AGE_MS;
    const list = [
      entry(["a"], { savedAt: now - SEARCH_MAX_AGE_MS - 1 }),
      entry(["b"], { owner: "autre", savedAt: now }),
      entry(["c"], { kind: "entity", savedAt: now - SEARCH_MAX_AGE_MS - 1, usedAt: now }),
      entry(["d"], { savedAt: now, usedAt: now - 5 }),
      entry(["e"], { savedAt: now, usedAt: now - 1 }),
    ];
    // « b » appartient à une autre identité : gardée, à ses propres bornes.
    expect(evictionPlan(list, OWNER, now, 2).sort()).toEqual([JSON.stringify(["a"]), JSON.stringify(["d"])].sort());
    expect(evictionPlan(list.slice(3), OWNER, now, 10, 150)).toEqual([JSON.stringify(["d"])]);
  });

  it("au-delà de MAX_OWNERS identités, les moins récentes partent — jamais celle en cours", () => {
    const now = 1_000_000;
    const list = ["u1", "u2", "u3", "u4", "u5"].map((who, i) => entry([who], { owner: who, savedAt: now, usedAt: now - i * 10 }));
    list.push(entry(["moi"], { owner: OWNER, savedAt: now, usedAt: 0 }));
    expect(evictionPlan(list, OWNER, now, 150, Infinity, 4).sort()).toEqual([JSON.stringify(["u4"]), JSON.stringify(["u5"])].sort());
  });

  it("deux identités gardent la même clé sans s'écraser", () => {
    expect(entryId("http://srv|a", '["music","home"]')).not.toBe(entryId("http://srv|b", '["music","home"]'));
  });
});

describe("hydratation et écriture", () => {
  it("rend les pages de l'identité avec leur vraie date, jamais celles d'une autre (gardées à leur nom)", async () => {
    const backend = memoryBackend([entry(SEARCH_KEY, { savedAt: Date.now() - 60_000 }), entry(ALBUM_KEY, { owner: "autre", kind: "entity", data: { key: "x" }, savedAt: Date.now() })]);
    const qc = client();
    const result = await hydrateOctaveCache(qc, backend, OWNER);
    expect(result.restored).toBe(1);
    expect(qc.getQueryData(SEARCH_KEY)).toEqual(search(page()));
    expect(qc.getQueryState(SEARCH_KEY)?.dataUpdatedAt).toBeLessThan(Date.now() - 59_000);
    expect(qc.getQueryData(ALBUM_KEY)).toBeUndefined();
    await Promise.resolve();
    expect(backend.entries.has(JSON.stringify(ALBUM_KEY))).toBe(true);
  });

  it("n'écrase jamais une donnée déjà en mémoire", async () => {
    const backend = memoryBackend([entry(SEARCH_KEY, { savedAt: Date.now() })]);
    const qc = client();
    const live = search(page({ query: "live" }));
    qc.setQueryData(SEARCH_KEY, live);
    await hydrateOctaveCache(qc, backend, OWNER);
    expect(qc.getQueryData(SEARCH_KEY)).toBe(live);
  });

  it("garde une page finie reçue, par lot, et pas une provisoire", async () => {
    const backend = memoryBackend();
    const qc = client();
    const detach = attachOctaveCache(qc, backend, OWNER, { flushDelayMs: 0 });
    await qc.fetchQuery({ queryKey: SEARCH_KEY, queryFn: async () => search(page()) });
    await qc.fetchQuery({ queryKey: [...SEARCH_KEY.slice(0, 4), "demons", 20], queryFn: async () => search(page({ complete: false, provisional: true })) });
    await qc.fetchQuery({ queryKey: ALBUM_KEY, queryFn: async () => ({ key: "album", artworkUrl: "https://lh3/b" }) });
    await new Promise((r) => setTimeout(r, 5));
    detach();
    expect([...backend.entries.keys()].sort()).toEqual([entryId(OWNER, JSON.stringify(ALBUM_KEY)), entryId(OWNER, JSON.stringify(SEARCH_KEY))].sort());
    const saved = backend.entries.get(entryId(OWNER, JSON.stringify(SEARCH_KEY)));
    expect(saved?.owner).toBe(OWNER);
    expect(saved?.bytes).toBeGreaterThan(10);

    // Le rechargement suivant : la recherche revient sans réseau.
    const next = client();
    await hydrateOctaveCache(next, backend, OWNER);
    expect(next.getQueryData(SEARCH_KEY)).toEqual(search(page()));
    expect(next.getQueryData(ALBUM_KEY)).toEqual({ key: "album", artworkUrl: "https://lh3/b" });
  });

  it("tient la borne d'entrées en écrivant", async () => {
    const backend = memoryBackend();
    const qc = client();
    const known = Array.from({ length: 150 }, (_, i) => ({ ...entry(["music", "external", "album", `old-${i}`], { kind: "entity", savedAt: Date.now(), usedAt: i }), data: undefined }));
    await backend.put(known.map((k) => ({ ...k, data: { key: k.id } })));
    const detach = attachOctaveCache(qc, backend, OWNER, { flushDelayMs: 0, known: known.map(({ data: _d, ...m }) => m) });
    await qc.fetchQuery({ queryKey: ALBUM_KEY, queryFn: async () => ({ key: "neuf" }) });
    await new Promise((r) => setTimeout(r, 5));
    detach();
    expect(backend.entries.size).toBe(150);
    expect(backend.entries.has(entryId(OWNER, JSON.stringify(ALBUM_KEY)))).toBe(true);
    expect(backend.entries.has(JSON.stringify(["music", "external", "album", "old-0"]))).toBe(false);
  });
});

describe("pochettes des pages gardées", () => {
  it("prend les images dans l'ordre de l'écran, sans doublon, bornées", () => {
    const data = search(page({ tracks: [{ artworkUrl: "a" }, { artworkUrl: "b" }, { artworkUrl: "a" }], artists: [{ imageUrl: "c" }] }));
    expect(artworkUrlsOf(data, 10)).toEqual(["a", "b", "c"]);
    expect(artworkUrlsOf({ artworkUrl: "x", tracks: [{ artworkUrl: "y" }] }, 1)).toEqual(["x"]);
    expect(warmArtworkList([{ artworkUrl: "x" }, { artworkUrl: "x", imageUrl: "z" }], 5)).toEqual(["x", "z"]);
  });
});

describe("préconnexion aux hôtes des pochettes", () => {
  it("les origines https des données, les plus vues d'abord, hors la page elle-même, bornées", () => {
    const urls = ["https://img.a/1", "https://img.b/1", "https://img.a/2", "/api/plugins/x/art", "http://insecure/1", "https://page.test/x", null, "pas une url"];
    expect(preconnectOrigins(urls, "https://page.test")).toEqual(["https://img.a", "https://img.b"]);
    expect(preconnectOrigins(urls, "https://page.test", 1)).toEqual(["https://img.a"]);
  });
});
