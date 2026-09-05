import { describe, expect, it } from "vitest";
import { WHATS_NEW_SEEN_KEY, readSeenVersion, writeSeenVersion } from "./whatsNewStorage";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

describe("version vue de l'écran de nouveautés", () => {
  it("aller-retour sous la clé historique", () => {
    const storage = memoryStorage();
    writeSeenVersion("1.21.0", storage);
    expect(storage.store.get(WHATS_NEW_SEEN_KEY)).toBe("1.21.0");
    expect(readSeenVersion(storage)).toBe("1.21.0");
  });

  it("null sans valeur, pour une valeur illisible ou sans stockage", () => {
    expect(readSeenVersion(memoryStorage())).toBeNull();
    expect(readSeenVersion(memoryStorage({ [WHATS_NEW_SEEN_KEY]: "oops" }))).toBeNull();
    expect(readSeenVersion(memoryStorage({ [WHATS_NEW_SEEN_KEY]: "" }))).toBeNull();
    expect(readSeenVersion(null)).toBeNull();
  });

  it("n'écrit pas n'importe quoi et survit à un stockage qui refuse", () => {
    const storage = memoryStorage();
    writeSeenVersion("dev", storage);
    expect(storage.store.size).toBe(0);
    const refusing = {
      getItem: () => {
        throw new Error("refusé");
      },
      setItem: () => {
        throw new Error("refusé");
      },
    };
    expect(() => writeSeenVersion("1.21.0", refusing)).not.toThrow();
    expect(readSeenVersion(refusing)).toBeNull();
  });
});
