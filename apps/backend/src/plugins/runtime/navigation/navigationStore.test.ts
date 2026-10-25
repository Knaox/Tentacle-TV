import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNavigationStore } from "./navigationStore";
import type { PluginNavigationDoc } from "./pluginNavigation";

const doc = (label: string | null, primary = true): PluginNavigationDoc => ({ items: [{ path: "/p", label, primary }] });

/** Une lecture qu'on résout à la main. */
function deferredFetch() {
  const calls: Array<(value: PluginNavigationDoc | null) => void> = [];
  const fetch = vi.fn(() => new Promise<PluginNavigationDoc | null>((done) => calls.push(done)));
  return { fetch, resolve: (index: number, value: PluginNavigationDoc | null) => calls[index](value), calls };
}

describe("magasin de navigation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("première lecture : attend la réponse de l'invité", async () => {
    const store = createNavigationStore({ fetch: async () => doc("Mes sons") });
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Mes sons"));
  });

  it("invité muet : jamais plus d'une seconde, puis comportement d'avant (null)", async () => {
    const f = deferredFetch();
    const store = createNavigationStore({ fetch: f.fetch });
    const pending = store.read("x", "/navigation");
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    // La lecture continue en fond et sert la requête suivante, sans attente.
    f.resolve(0, doc("Tard"));
    await vi.advanceTimersByTimeAsync(0);
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Tard"));
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });

  it("requêtes simultanées : une seule lecture, une seule fenêtre d'une seconde", async () => {
    const f = deferredFetch();
    const store = createNavigationStore({ fetch: f.fetch });
    const first = store.read("x", "/navigation");
    await vi.advanceTimersByTimeAsync(600);
    const second = store.read("x", "/navigation");
    await vi.advanceTimersByTimeAsync(400);
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });

  it("valeur connue : servie aussitôt, relue en fond une fois vieillie", async () => {
    let label = "Un";
    const fetch = vi.fn(async () => doc(label));
    const store = createNavigationStore({ fetch, refreshAfterMs: 60_000 });
    await store.read("x", "/navigation");
    label = "Deux";
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Un"));
    await vi.advanceTimersByTimeAsync(0);
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Deux"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("après une écriture : la lecture suivante attend la nouvelle valeur", async () => {
    let label = "Avant";
    const store = createNavigationStore({ fetch: async () => doc(label) });
    await store.read("x", "/navigation");
    label = "Après";
    store.invalidate("x", "/navigation?x=1");
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Après"));
  });

  it("une écriture PENDANT une lecture relit derrière elle", async () => {
    const f = deferredFetch();
    const store = createNavigationStore({ fetch: f.fetch, refreshAfterMs: 0 });
    const first = store.read("x", "/navigation");
    f.resolve(0, doc("Un"));
    await first;
    void store.read("x", "/navigation"); // relecture de fond (valeur vieillie)
    store.invalidate("x", "/navigation");
    f.resolve(1, doc("Lue avant l'écriture"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetch).toHaveBeenCalledTimes(3);
    const after = store.read("x", "/navigation");
    f.resolve(2, doc("Après l'écriture"));
    await expect(after).resolves.toEqual(doc("Après l'écriture"));
  });

  it("une autre route que celle déclarée n'invalide rien", async () => {
    const fetch = vi.fn(async () => doc("Un"));
    const store = createNavigationStore({ fetch });
    await store.read("x", "/navigation");
    store.invalidate("x", "/admin/settings");
    await store.read("x", "/navigation");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("une réponse illisible garde la dernière valeur connue", async () => {
    let next: PluginNavigationDoc | null = doc("Bon");
    const store = createNavigationStore({ fetch: async () => next });
    await store.read("x", "/navigation");
    next = null;
    store.invalidate("x", "/navigation");
    await expect(store.read("x", "/navigation")).resolves.toEqual(doc("Bon"));
  });
});
