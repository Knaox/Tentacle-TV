import { describe, expect, it } from "vitest";
import { cleanupObsoleteStorage } from "./storageCleanup";

/** Un stockage qui se souvient de ce qu'on lui a demandé de retirer. */
function fakeStore(): { removed: string[]; removeItem: (k: string) => void } {
  const removed: string[] = [];
  return { removed, removeItem: (k) => void removed.push(k) };
}

describe("cleanupObsoleteStorage", () => {
  it("retire la clé du mode économe, que plus personne ne lit", () => {
    const store = fakeStore();
    cleanupObsoleteStorage(store);
    expect(store.removed).toContain("tentacle_render_quality");
  });

  it("ne touche à rien d'autre", () => {
    // Les clés vivantes — jeton, décodage matériel — ne sont pas visées : le
    // nettoyage ne connaît que sa liste, jamais le contenu du stockage.
    const store = fakeStore();
    cleanupObsoleteStorage(store);
    expect(store.removed).toEqual(["tentacle_render_quality"]);
  });

  it("un stockage qui lève ne fait pas tomber le démarrage", () => {
    const store = {
      removeItem: (): void => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => cleanupObsoleteStorage(store)).not.toThrow();
  });
});
