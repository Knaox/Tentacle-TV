import { describe, expect, it } from "vitest";

import type { ToneRect } from "./backdropTone";
import {
  SURFACE_TONE_GIVE_UP_MS,
  SURFACE_TONE_REMEASURE_DELAY_MS,
  startSurfaceToneProbe,
  surfaceToneEpoch,
} from "./surfaceToneProbe";

/**
 * La mesure du ton TENU d'une grande surface, et ce qui la relance : le thème
 * et le matériau du système (défaut 25 de l'audit lg2 — la barre latérale
 * restait claire sur la page passée en Sombre), jamais rien d'autre.
 */

/** Une horloge et un ordonnanceur à la main : le lot de la couronne revient quand on le dit. */
function harness() {
  let now = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  let next = 1;
  const observed = new Map<string, { rect: () => ToneRect | null; onLuminance: (l: number) => void }>();
  const deps = {
    scheduler: {
      observe: (id: string, rect: () => ToneRect | null, onLuminance: (l: number) => void) =>
        void observed.set(id, { rect, onLuminance }),
      unwatch: (id: string) => void observed.delete(id),
    },
    rectOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    setTimer: (callback: () => void, ms: number) => {
      const handle = next++;
      timers.set(handle, { at: now + ms, callback });
      return handle;
    },
    clearTimer: (handle: unknown) => void timers.delete(handle as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [handle, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at > now || !timers.has(handle)) continue;
      timers.delete(handle);
      timer.callback();
    }
  };
  /** La coquille répond : la même luminance sur chaque bande observée. */
  const answer = (luminance: number) => {
    for (const { onLuminance } of [...observed.values()]) onLuminance(luminance);
  };
  return { deps, observed, timers, advance, answer };
}

describe("ce qui rend le ton tenu caduc", () => {
  it("le thème (Clair, Sombre, Auto résolu) et le matériau du système, rien d'autre", () => {
    expect(surfaceToneEpoch("light", "liquid")).not.toBe(surfaceToneEpoch("dark", "liquid"));
    expect(surfaceToneEpoch("dark", "liquid")).not.toBe(surfaceToneEpoch("dark", "frosted"));
    expect(surfaceToneEpoch("dark", "liquid")).toBe(surfaceToneEpoch("dark", "liquid"));
  });
});

describe("une mesure", () => {
  it("à l'ouverture : la couronne, un ton, puis plus rien d'abonné", () => {
    const h = harness();
    const tones: string[] = [];
    startSurfaceToneProbe("s", "dark", h.deps, (t) => tones.push(t));
    expect(h.observed.size).toBe(4);
    h.answer(0.9);
    h.advance(0);
    expect(tones).toEqual(["light"]);
    expect(h.observed.size).toBe(0);
    expect(h.timers.size).toBe(0);
    // Le héros tourne dessous : personne ne relit, le ton reste tenu.
    h.answer(0.01);
    h.advance(5000);
    expect(tones).toEqual(["light"]);
  });

  it("défaut 25 : Clair → Sombre, la surface ouverte se remesure APRÈS le repeint", () => {
    const h = harness();
    const tones: string[] = [];
    // Ouverte en Clair sur une page claire.
    const stopLight = startSurfaceToneProbe("s:light|liquid", "light", h.deps, (t) => tones.push(t));
    h.answer(0.92);
    h.advance(0);
    expect(tones).toEqual(["light"]);
    stopLight();
    // « Sombre » : l'ancienne mesure est jetée (le hook rend le ton du thème),
    // la nouvelle attend que la page se repeigne avant de capturer.
    startSurfaceToneProbe("s:dark|liquid", "dark", h.deps, (t) => tones.push(t), SURFACE_TONE_REMEASURE_DELAY_MS);
    expect(h.observed.size).toBe(0);
    h.advance(SURFACE_TONE_REMEASURE_DELAY_MS);
    expect(h.observed.size).toBe(4);
    h.answer(0.02);
    h.advance(0);
    expect(tones).toEqual(["light", "dark"]);
  });

  it("annulée (démontage, autre thème) : jamais de ton rendu après coup", () => {
    const h = harness();
    const tones: string[] = [];
    const stop = startSurfaceToneProbe("s", "dark", h.deps, (t) => tones.push(t), SURFACE_TONE_REMEASURE_DELAY_MS);
    stop();
    h.advance(SURFACE_TONE_REMEASURE_DELAY_MS + SURFACE_TONE_GIVE_UP_MS);
    h.answer(0.9);
    expect(tones).toEqual([]);
    expect(h.observed.size).toBe(0);
    expect(h.timers.size).toBe(0);
  });

  it("la coquille ne répond pas : on renonce, le ton du thème reste", () => {
    const h = harness();
    const tones: string[] = [];
    startSurfaceToneProbe("s", "light", h.deps, (t) => tones.push(t));
    h.advance(SURFACE_TONE_GIVE_UP_MS);
    expect(tones).toEqual([]);
    expect(h.observed.size).toBe(0);
  });

  it("un dessous moyen garde le ton supposé (celui du thème courant)", () => {
    const h = harness();
    const tones: string[] = [];
    startSurfaceToneProbe("s", "dark", h.deps, (t) => tones.push(t));
    h.answer(0.22);
    h.advance(0);
    expect(tones).toEqual(["dark"]);
  });
});
