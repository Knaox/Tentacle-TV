import { describe, expect, it } from "vitest";
import { CROSSFADE_STORAGE_KEY, createCrossfadeSetting, storedCrossfadeMs, type SyncStorage } from "./crossfadeSetting";

function memory(initial: Record<string, string> = {}): SyncStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("transition douce — le réglage de l'appareil", () => {
  it("un appareil qui n'a rien choisi l'a allumée, à 5 s", () => {
    expect(storedCrossfadeMs(null)).toBe(5_000);
    expect(storedCrossfadeMs("")).toBe(5_000);
    expect(storedCrossfadeMs("abc")).toBe(5_000);
  });

  it("« 0 » gardé = coupée par l'utilisateur ; une durée gardée est bornée", () => {
    expect(storedCrossfadeMs("0")).toBe(0);
    expect(storedCrossfadeMs("8000")).toBe(8_000);
    expect(storedCrossfadeMs("40000")).toBe(12_000);
  });

  it("écrit, prévient, et ne prévient pas pour la même valeur", () => {
    const storage = memory();
    const store = createCrossfadeSetting(() => storage);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.get()).toBe(5_000);
    store.set(5_000);
    expect(calls).toBe(0);
    store.set(0);
    expect(storage.data[CROSSFADE_STORAGE_KEY]).toBe("0");
    expect(store.get()).toBe(0);
    store.set(7_400);
    expect(store.get()).toBe(7_000);
    expect(calls).toBe(2);
  });

  it("un stockage qui lève ne casse rien", () => {
    const store = createCrossfadeSetting(() => ({ getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("y"); } }));
    expect(store.get()).toBe(5_000);
    store.set(8_000);
    expect(store.get()).toBe(8_000);
  });

  it("une valeur déjà choisie (3 s, l'ancien défaut) reste la sienne", () => {
    const storage = memory({ [CROSSFADE_STORAGE_KEY]: "3000" });
    expect(createCrossfadeSetting(() => storage).get()).toBe(3_000);
  });
});
