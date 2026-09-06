/**
 * Ce qui mérite d'être figé n'est pas « ça se relit » mais la BORNE du miroir
 * par contenu (un magasin qui gonfle se paie à chaque lecture), le
 * cloisonnement par compte, et la priorité des modifications hors ligne sur la
 * photo du serveur.
 */

import { describe, expect, it } from "vitest";
import {
  cacheLibraryPrefs,
  ITEM_TRACKS_MAX_ENTRIES,
  itemTracksFor,
  itemTracksKey,
  langPrefix,
  prefForLibrary,
  queuePendingPref,
  readLibrariesList,
  readLibraryPrefs,
  readPendingPrefs,
  rememberItemTracks,
  sameLang,
  cacheLibrariesList,
  type KeyValueStore,
} from "./trackPrefsCache";

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v);
    },
    remove: (k) => {
      map.delete(k);
    },
  };
}

const choice = (audio: string) => ({ audioLang: audio, subtitleLang: null, subtitleMode: "none" as const });
const MAX = ITEM_TRACKS_MAX_ENTRIES;

describe("langues par contenu", () => {
  it("relit ce qui vient d'être écrit, et rien d'autre", () => {
    const store = memoryStore();
    rememberItemTracks(store, "u1", "film-1", { audioLang: "eng", subtitleLang: "fre", subtitleMode: "always" });
    expect(itemTracksFor(store, "u1", "film-1")).toEqual({ audioLang: "eng", subtitleLang: "fre", subtitleMode: "always" });
    expect(itemTracksFor(store, "u1", "film-2")).toBeNull();
    expect(itemTracksFor(store, "u1", null)).toBeNull();
  });

  it("écrase l'entrée d'un contenu au lieu de la dupliquer", () => {
    const store = memoryStore();
    rememberItemTracks(store, "u1", "film-1", choice("fre"));
    rememberItemTracks(store, "u1", "film-1", choice("jpn"));
    expect(itemTracksFor(store, "u1", "film-1")?.audioLang).toBe("jpn");
    expect(JSON.parse(store.map.get(itemTracksKey("u1")) ?? "[]")).toHaveLength(1);
  });

  it("plafonne le miroir et évince la plus ancienne", () => {
    const store = memoryStore();
    for (let i = 0; i < MAX + 25; i++) rememberItemTracks(store, "u1", `ep-${i}`, choice("fre"));
    expect(JSON.parse(store.map.get(itemTracksKey("u1")) ?? "[]")).toHaveLength(MAX);
    expect(itemTracksFor(store, "u1", "ep-0")).toBeNull();
    expect(itemTracksFor(store, "u1", "ep-24")).toBeNull();
    expect(itemTracksFor(store, "u1", "ep-25")).not.toBeNull();
  });

  it("garde une entrée re-touchée, même ancienne", () => {
    const store = memoryStore();
    rememberItemTracks(store, "u1", "preferee", choice("jpn"));
    for (let i = 0; i < MAX - 1; i++) rememberItemTracks(store, "u1", `ep-${i}`, choice("fre"));
    rememberItemTracks(store, "u1", "preferee", choice("jpn"));
    for (let i = 0; i < 20; i++) rememberItemTracks(store, "u1", `autre-${i}`, choice("fre"));
    expect(itemTracksFor(store, "u1", "preferee")?.audioLang).toBe("jpn");
  });

  it("sépare strictement les comptes", () => {
    const store = memoryStore();
    rememberItemTracks(store, "u1", "film-1", choice("fre"));
    expect(itemTracksFor(store, "u2", "film-1")).toBeNull();
    rememberItemTracks(store, "u2", "film-1", choice("eng"));
    expect(itemTracksFor(store, "u1", "film-1")?.audioLang).toBe("fre");
  });
});

describe("préférences par bibliothèque", () => {
  const rows = [
    { libraryId: "1111aaaa-bbbb-cccc-dddd-eeeeffff0000", audioLang: "jpn", subtitleLang: "fre", subtitleMode: "always" },
    { libraryId: "lib-2", audioLang: "fre", subtitleLang: null, subtitleMode: "bogus" },
    { pasUneLigne: true },
  ];

  it("photographie le serveur avec tolérance, et retrouve une bibliothèque sans ses tirets", () => {
    const store = memoryStore();
    cacheLibraryPrefs(store, "u1", rows);
    expect(prefForLibrary(store, "u1", "1111AAAABBBBCCCCDDDDEEEEFFFF0000")?.audioLang).toBe("jpn");
    expect(prefForLibrary(store, "u1", "lib-2")?.subtitleMode).toBe("none");
    // Deux préférences : une bibliothèque inconnue ne retombe sur rien.
    expect(prefForLibrary(store, "u1", "inconnue")).toBeNull();
  });

  it("une instance mono-usage retombe sur son unique préférence", () => {
    const store = memoryStore();
    cacheLibraryPrefs(store, "u1", [rows[1]]);
    expect(prefForLibrary(store, "u1", null)?.libraryId).toBe("lib-2");
  });

  it("une modification hors ligne prime sur la photo, jusqu'à être poussée", () => {
    const store = memoryStore();
    cacheLibraryPrefs(store, "u1", rows);
    queuePendingPref(store, "u1", { libraryId: "lib-2", audioLang: "eng", subtitleLang: null, subtitleMode: "none" });
    expect(prefForLibrary(store, "u1", "lib-2")?.audioLang).toBe("eng");
    // Une nouvelle photo du serveur ne l'écrase pas.
    cacheLibraryPrefs(store, "u1", rows);
    expect(prefForLibrary(store, "u1", "lib-2")?.audioLang).toBe("eng");
    expect(readPendingPrefs(store, "u1").map((p) => p.libraryId)).toEqual(["lib-2"]);
    // Une réinitialisation en attente retire la bibliothèque du cache (le
    // repli « unique préférence » peut alors rendre l'autre bibliothèque).
    queuePendingPref(store, "u1", { libraryId: "lib-2", audioLang: null, subtitleLang: null, subtitleMode: "none", reset: true });
    expect(readLibraryPrefs(store, "u1").map((p) => p.libraryId)).toEqual([rows[0]?.libraryId]);
  });

  it("garde la liste des bibliothèques pour la page hors ligne", () => {
    const store = memoryStore();
    cacheLibrariesList(store, "u1", [{ Id: "a", Name: "Films" }]);
    expect(readLibrariesList(store, "u1")).toEqual([{ id: "a", name: "Films" }]);
    expect(readLibrariesList(store, "u2")).toEqual([]);
  });
});

describe("langues", () => {
  it("ramène les alias à ISO-B", () => {
    expect(langPrefix("fra")).toBe("fre");
    expect(langPrefix("fre-vff")).toBe("fre");
    expect(langPrefix("de")).toBe("ger");
    expect(langPrefix("en-US")).toBe("eng");
    expect(sameLang("fr", "fre")).toBe(true);
    expect(sameLang("", "fre")).toBe(false);
    expect(sameLang(null, undefined)).toBe(false);
  });
});
