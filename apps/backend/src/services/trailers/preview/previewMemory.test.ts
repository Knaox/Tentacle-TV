/**
 * Les deux mémoires de l'aperçu : la mémoire bornée à échéance (décisions,
 * titres) et le seau de chaque compte.
 */

import { describe, expect, it } from "vitest";
import { PreviewRateLimiter } from "./previewRateLimit";
import { TtlLru } from "./ttlLru";

describe("mémoire bornée à échéance", () => {
  it("rend une entrée jusqu'à son échéance, plus après", () => {
    const memory = new TtlLru<string>(10);
    memory.set("a", "A", 1_000, 0);
    expect(memory.get("a", 999)).toBe("A");
    expect(memory.get("a", 1_000)).toBeUndefined();
    expect(memory.size).toBe(0);
  });

  it("pleine, oublie la moins récemment servie", () => {
    const memory = new TtlLru<number>(2);
    memory.set("a", 1, 60_000, 0);
    memory.set("b", 2, 60_000, 0);
    expect(memory.get("a", 1)).toBe(1);
    memory.set("c", 3, 60_000, 2);
    expect(memory.get("b", 3)).toBeUndefined();
    expect(memory.get("a", 3)).toBe(1);
    expect(memory.get("c", 3)).toBe(3);
  });

  it("une durée nulle ou négative n'est pas gardée", () => {
    const memory = new TtlLru<number>(2);
    memory.set("a", 1, 0, 0);
    memory.set("b", 2, -5, 0);
    expect(memory.size).toBe(0);
  });
});

describe("seau des aperçus, par compte", () => {
  it("quelques aperçus d'avance, puis un toutes les cinq secondes", () => {
    const limiter = new PreviewRateLimiter(3, 5_000);
    for (let i = 0; i < 3; i++) expect(limiter.take("u", 0)).toEqual({ ok: true });
    expect(limiter.take("u", 0)).toEqual({ ok: false, retryAfterS: 5 });
    expect(limiter.take("u", 4_000)).toEqual({ ok: false, retryAfterS: 1 });
    expect(limiter.take("u", 5_000)).toEqual({ ok: true });
    expect(limiter.take("u", 5_001)).toEqual({ ok: false, retryAfterS: 5 });
  });

  it("chaque compte a son seau", () => {
    const limiter = new PreviewRateLimiter(1, 5_000);
    expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("a", 0).ok).toBe(false);
    expect(limiter.take("b", 0).ok).toBe(true);
  });

  it("un seau oublié repart plein ; le nombre de seaux est borné", () => {
    const limiter = new PreviewRateLimiter(1, 5_000, 2);
    expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("b", 0).ok).toBe(true);
    expect(limiter.take("c", 0).ok).toBe(true);
    // « a », le plus ancien, a été oublié : il repart plein.
    expect(limiter.take("a", 0).ok).toBe(true);
  });
});
