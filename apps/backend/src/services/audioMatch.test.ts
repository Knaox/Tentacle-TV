/**
 * L'appariement sur des empreintes SYNTHÉTIQUES (générateur semé) : un bloc
 * commun placé à des décalages différents se retrouve, le bruit ne donne rien,
 * le silence ne vote pas, et la force brute prend le relais quand la jointure
 * exacte ne voit rien.
 */

import { describe, expect, it, vi } from "vitest";
import { POINTS_PER_SECOND } from "./audioFingerprintTool";
import {
  MAX_HAMMING,
  MIN_VOTES,
  bestOffsets,
  compareWindows,
  denseZones,
  markDead,
  popcount32,
  voteByForce,
  voteByHash,
} from "./audioMatch";

/** mulberry32 — un générateur semé, reproductible d'un test à l'autre. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pts = (seconds: number) => Math.round(seconds * POINTS_PER_SECOND);

/** Des points aléatoires — comme deux épisodes sans rien en commun. */
function noise(count: number, seed: number): Uint32Array {
  const next = rng(seed);
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) out[i] = Math.floor(next() * 4294967296) >>> 0;
  return out;
}

/** Retourne `bits` bits choisis au hasard dans chaque point (une autre grille, un autre encodage). */
function perturb(points: Uint32Array, bits: number, seed: number): Uint32Array {
  const next = rng(seed);
  const out = new Uint32Array(points.length);
  for (let i = 0; i < points.length; i++) {
    let v = points[i];
    const flipped = new Set<number>();
    while (flipped.size < bits) flipped.add(Math.floor(next() * 32));
    for (const b of flipped) v ^= 1 << b;
    out[i] = v >>> 0;
  }
  return out;
}

/** Deux fenêtres de 5 min portant le même bloc de `blockS` secondes, à des places différentes. */
function pair(blockS: number, atA: number, atB: number, bits = 0) {
  const a = noise(pts(300), 1);
  const b = noise(pts(300), 2);
  const block = noise(pts(blockS), 3);
  a.set(block, pts(atA));
  b.set(bits === 0 ? block : perturb(block, bits, 4), pts(atB));
  return { a: { points: a, startMs: 0 }, b: { points: b, startMs: 0 } };
}

describe("popcount32", () => {
  it("compte les bits, signés compris", () => {
    expect(popcount32(0)).toBe(0);
    expect(popcount32(0xffffffff)).toBe(32);
    expect(popcount32(0x80000001)).toBe(2);
    expect(popcount32(-1)).toBe(32);
  });
});

describe("compareWindows", () => {
  it("retrouve un bloc de 90 s placé à 20 s dans A et 47 s dans B, à ±2 s", async () => {
    const { a, b } = pair(90, 20, 47);
    const zones = await compareWindows(a, b);
    expect(zones).toHaveLength(1);
    expect(zones[0].aStartMs).toBeGreaterThanOrEqual(18_000);
    expect(zones[0].aStartMs).toBeLessThanOrEqual(22_000);
    expect(zones[0].aEndMs).toBeGreaterThanOrEqual(108_000);
    expect(zones[0].aEndMs).toBeLessThanOrEqual(112_000);
    expect(zones[0].bStartMs).toBeGreaterThanOrEqual(45_000);
    expect(zones[0].bStartMs).toBeLessThanOrEqual(49_000);
    expect(zones[0].offsetMs).toBeCloseTo(27_000, -3);
    expect(zones[0].density).toBeGreaterThan(0.95);
    expect(zones[0].votes).toBeGreaterThanOrEqual(MIN_VOTES);
  });

  it("du bruit contre du bruit ne donne rien", async () => {
    const zones = await compareWindows({ points: noise(pts(300), 7), startMs: 0 }, { points: noise(pts(300), 8), startMs: 0 });
    expect(zones).toEqual([]);
  });

  it("un bloc dont chaque point a perdu six bits matche encore — huit, plus", async () => {
    const six = await compareWindows(...Object.values(pair(60, 10, 100, MAX_HAMMING)) as [never, never]);
    expect(six).toHaveLength(1);
    expect(six[0].density).toBeGreaterThan(0.9);
    const eight = await compareWindows(...Object.values(pair(60, 10, 100, MAX_HAMMING + 2)) as [never, never]);
    expect(eight).toEqual([]);
  });

  it("un silence commun (valeurs identiques) ne vote pas et ne fait pas de zone", async () => {
    const a = noise(pts(300), 11);
    const b = noise(pts(300), 12);
    a.fill(0, pts(30), pts(90));
    b.fill(0, pts(120), pts(180));
    expect(await compareWindows({ points: a, startMs: 0 }, { points: b, startMs: 0 })).toEqual([]);
    expect(markDead(a).slice(pts(30), pts(90)).every((v) => v === 1)).toBe(true);
    expect(markDead(a)[0]).toBe(0);
  });

  it("les temps sont ceux du média : l'origine de chaque fenêtre s'ajoute", async () => {
    const { a, b } = pair(60, 100, 40);
    const zones = await compareWindows({ ...a, startMs: 1_060_000 }, { ...b, startMs: 1_000_000 });
    expect(zones[0].aStartMs).toBeGreaterThanOrEqual(1_158_000);
    expect(zones[0].bStartMs).toBeGreaterThanOrEqual(1_038_000);
  });

  it("deux blocs distincts donnent deux zones, dans l'ordre de A", async () => {
    const a = noise(pts(300), 21);
    const b = noise(pts(300), 22);
    const first = noise(pts(30), 23);
    const second = noise(pts(40), 24);
    a.set(first, pts(10));
    a.set(second, pts(200));
    b.set(first, pts(50));
    b.set(second, pts(100));
    const zones = await compareWindows({ points: a, startMs: 0 }, { points: b, startMs: 0 });
    expect(zones).toHaveLength(2);
    expect(zones[0].aStartMs).toBeLessThan(zones[1].aStartMs);
  });
});

describe("les votes", () => {
  it("la jointure exacte et la force brute désignent le même décalage", async () => {
    const { a, b } = pair(30, 5, 65);
    const deadA = markDead(a.points);
    const deadB = markDead(b.points);
    const byHash = bestOffsets(voteByHash(a.points, b.points, deadA, deadB), a.points.length);
    const byForce = bestOffsets(await voteByForce(a.points, b.points, deadA, deadB), a.points.length);
    expect(byHash[0]).toBe(pts(60));
    expect(byForce[0]).toBe(pts(60));
  });

  it("la force brute rend la main à la boucle d'événements", async () => {
    const spy = vi.spyOn(globalThis, "setImmediate");
    const a = noise(pts(60), 31);
    await voteByForce(a, noise(pts(60), 32), markDead(a), new Uint8Array(pts(60)));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("des décalages voisins ne comptent qu'une fois", () => {
    const votes = new Int32Array(200);
    votes[100] = 100;
    votes[101] = 90;
    votes[150] = 80;
    expect(bestOffsets(votes, 100)).toEqual([0, 50]);
  });
});

describe("denseZones", () => {
  it("fusionne un trou court, coupe sur un trou long, resserre sur les points appariés", () => {
    const hits = new Uint8Array(400);
    hits.fill(1, 10, 60);
    hits.fill(1, 70, 120); // trou de 10 points ≈ 1,2 s : fusionné
    hits.fill(1, 200, 250); // trou de 80 points ≈ 10 s : séparé
    const zones = denseZones(hits);
    expect(zones).toEqual([
      { start: 10, end: 120 },
      { start: 200, end: 250 },
    ]);
  });
});
