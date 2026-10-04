import { describe, expect, it, vi } from "vitest";
import {
  createScrubCountdownStore,
  parseScrubCountdownSettings,
  SCRUB_COUNTDOWN_DEFAULTS,
  scrubCountdownKey,
  scrubCountdownPolicyOf,
  serializeScrubCountdownSettings,
} from "./scrubCountdownSettings";

/** Le stockage du téléviseur, en mémoire. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
  };
}

describe("le défaut et la politique", () => {
  it("revenir où j'étais, au bout de 5 s", () => {
    expect(SCRUB_COUNTDOWN_DEFAULTS).toEqual({ outcome: "return", delaySeconds: 5 });
    expect(scrubCountdownPolicyOf(SCRUB_COUNTDOWN_DEFAULTS)).toEqual({ outcome: "return", delayMs: 5000 });
    expect(scrubCountdownPolicyOf({ outcome: "resume", delaySeconds: 15 })).toEqual({ outcome: "resume", delayMs: 15_000 });
  });
});

describe("la valeur stockée", () => {
  it("fait l'aller-retour", () => {
    const settings = { outcome: "resume", delaySeconds: 10 } as const;
    expect(serializeScrubCountdownSettings(settings)).toBe('{"outcome":"resume","delay":10}');
    expect(parseScrubCountdownSettings(serializeScrubCountdownSettings(settings))).toEqual(settings);
  });

  it("absente, illisible ou d'un autre type : le défaut", () => {
    for (const raw of [null, "", "pas du json", "42", "null", "[]"]) {
      expect(parseScrubCountdownSettings(raw)).toEqual(SCRUB_COUNTDOWN_DEFAULTS);
    }
  });

  it("un champ inconnu vaut son défaut, sans emporter l'autre", () => {
    expect(parseScrubCountdownSettings('{"outcome":"resume","delay":7}')).toEqual({ outcome: "resume", delaySeconds: 5 });
    expect(parseScrubCountdownSettings('{"outcome":"plus tard","delay":15}')).toEqual({ outcome: "return", delaySeconds: 15 });
    expect(parseScrubCountdownSettings('{"delay":"10"}')).toEqual(SCRUB_COUNTDOWN_DEFAULTS);
  });
});

describe("le magasin, par compte", () => {
  it("chaque profil garde le sien, sous sa propre clé", () => {
    const storage = memoryStorage();
    const store = createScrubCountdownStore(storage);

    store.write("alice", { outcome: "resume" });
    store.write("bob", { delaySeconds: 15 });
    expect(store.read("alice")).toEqual({ outcome: "resume", delaySeconds: 5 });
    expect(store.read("bob")).toEqual({ outcome: "return", delaySeconds: 15 });
    expect(store.read("carol")).toEqual(SCRUB_COUNTDOWN_DEFAULTS);
    expect([...storage.items.keys()].sort()).toEqual([scrubCountdownKey("alice"), scrubCountdownKey("bob")]);
    expect(scrubCountdownKey("alice")).toBe("tentacle_scrub_countdown:alice");
  });

  it("relu par un nouveau magasin (relance de l'app) : le choix est toujours là", () => {
    const storage = memoryStorage();
    createScrubCountdownStore(storage).write("alice", { outcome: "resume", delaySeconds: 3 });

    expect(createScrubCountdownStore(storage).read("alice")).toEqual({ outcome: "resume", delaySeconds: 3 });
  });

  it("sans compte : le défaut, et rien ne s'écrit", () => {
    const storage = memoryStorage();
    const store = createScrubCountdownStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.write(null, { outcome: "resume" });
    expect(store.read(null)).toEqual(SCRUB_COUNTDOWN_DEFAULTS);
    expect(storage.items.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("instantané stable tant que rien ne change ; un vrai changement prévient les abonnés", () => {
    const store = createScrubCountdownStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    const first = store.read("alice");
    expect(store.read("alice")).toBe(first);
    store.write("alice", { outcome: "return", delaySeconds: 5 });
    expect(listener).not.toHaveBeenCalled();
    store.write("alice", { delaySeconds: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
    const second = store.read("alice");
    expect(second).not.toBe(first);
    expect(store.read("alice")).toBe(second);
    unsubscribe();
    store.write("alice", { delaySeconds: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stockage qui refuse l'écriture : le choix ne tient pas, l'ancien reste affiché", () => {
    const store = createScrubCountdownStore({
      getItem: () => null,
      setItem: () => { throw new Error("plein"); },
    });
    store.write("alice", { outcome: "resume" });
    expect(store.read("alice")).toEqual(SCRUB_COUNTDOWN_DEFAULTS);
  });
});
