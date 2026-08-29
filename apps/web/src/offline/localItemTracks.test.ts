import { beforeEach, describe, expect, it } from "vitest";
import { itemTracksFor, rememberItemTracks } from "./localItemTracks";

/**
 * Miroir local des langues retenues par contenu.
 *
 * Ce qui mérite d'être figé n'est pas « ça se relit » mais la BORNE : une entrée
 * par contenu regardé grandit sans fin, et un `localStorage` qui gonfle se paie
 * à chaque lecture, sur tous les appareils. Le plafond et son éviction sont donc
 * la seule chose que ce fichier surveille.
 */

/**
 * Les tests du projet tournent en environnement `node` : pas de `localStorage`.
 * On pose le strict minimum, comme le fait déjà `localStorageExport.test.ts`,
 * plutôt que d'ajouter jsdom pour un seul fichier.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

const MAX = 200;

beforeEach(() => {
  const store = new MemoryStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = store;
  store.setItem("tentacle_user", JSON.stringify({ Id: "user-1" }));
});

const choice = (audio: string) => ({
  audioLang: audio,
  subtitleLang: null,
  subtitleMode: "none" as const,
});

describe("mémorisation par contenu", () => {
  it("relit ce qui vient d'être écrit, et rien d'autre", () => {
    rememberItemTracks("film-1", { audioLang: "eng", subtitleLang: "fre", subtitleMode: "always" });
    expect(itemTracksFor("film-1")).toEqual({
      audioLang: "eng", subtitleLang: "fre", subtitleMode: "always",
    });
    expect(itemTracksFor("film-2")).toBeNull();
    expect(itemTracksFor(null)).toBeNull();
  });

  it("écrase l'entrée d'un contenu au lieu de la dupliquer", () => {
    rememberItemTracks("film-1", choice("fre"));
    rememberItemTracks("film-1", choice("jpn"));
    expect(itemTracksFor("film-1")?.audioLang).toBe("jpn");
    const raw = JSON.parse(localStorage.getItem("tentacle_item_tracks_user-1")!) as unknown[];
    expect(raw).toHaveLength(1);
  });

  it("plafonne le cache et évince la plus ancienne", () => {
    for (let i = 0; i < MAX + 25; i++) rememberItemTracks(`ep-${i}`, choice("fre"));
    const raw = JSON.parse(localStorage.getItem("tentacle_item_tracks_user-1")!) as unknown[];
    expect(raw).toHaveLength(MAX);
    // Les 25 premières ont sauté, les dernières sont là.
    expect(itemTracksFor("ep-0")).toBeNull();
    expect(itemTracksFor("ep-24")).toBeNull();
    expect(itemTracksFor("ep-25")).not.toBeNull();
    expect(itemTracksFor(`ep-${MAX + 24}`)).not.toBeNull();
  });

  it("garde une entrée re-touchée, même ancienne", () => {
    rememberItemTracks("preferee", choice("jpn"));
    for (let i = 0; i < MAX - 1; i++) rememberItemTracks(`ep-${i}`, choice("fre"));
    // Le cache est plein ; on retouche la doyenne, puis on pousse encore.
    rememberItemTracks("preferee", choice("jpn"));
    for (let i = 0; i < 20; i++) rememberItemTracks(`autre-${i}`, choice("fre"));
    expect(itemTracksFor("preferee")?.audioLang).toBe("jpn");
  });

  it("sépare strictement les comptes", () => {
    rememberItemTracks("film-1", choice("fre"));
    localStorage.setItem("tentacle_user", JSON.stringify({ Id: "user-2" }));
    expect(itemTracksFor("film-1")).toBeNull();
    rememberItemTracks("film-1", choice("eng"));
    expect(itemTracksFor("film-1")?.audioLang).toBe("eng");
    localStorage.setItem("tentacle_user", JSON.stringify({ Id: "user-1" }));
    expect(itemTracksFor("film-1")?.audioLang).toBe("fre");
  });

  it("ne fait rien, sans casser, quand personne n'est connecté", () => {
    localStorage.removeItem("tentacle_user");
    expect(() => rememberItemTracks("film-1", choice("fre"))).not.toThrow();
    expect(itemTracksFor("film-1")).toBeNull();
  });
});
