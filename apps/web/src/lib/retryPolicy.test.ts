import { describe, it, expect } from "vitest";
import { isRateLimitRefusal, retryUnlessRateLimited } from "./retryPolicy";

describe("isRateLimitRefusal", () => {
  it("reconnaît le status numérique d'une JellyfinError", () => {
    expect(isRateLimitRefusal({ status: 429 })).toBe(true);
    expect(isRateLimitRefusal({ status: 500 })).toBe(false);
  });

  it("reconnaît le corps d'erreur Fastify des enveloppes de fetch backend", () => {
    const corps = '{"statusCode":429,"error":"Too Many Requests","message":"Rate limit exceeded, retry in 1 minute"}';
    expect(isRateLimitRefusal(new Error(corps))).toBe(true);
  });

  it("ne confond pas 429 avec un autre statut ni avec un nombre croisé au hasard", () => {
    expect(isRateLimitRefusal(new Error('{"statusCode":4290}'))).toBe(false);
    expect(isRateLimitRefusal(new Error("429 films trouvés"))).toBe(false);
    expect(isRateLimitRefusal(null)).toBe(false);
    expect(isRateLimitRefusal("429")).toBe(false);
  });
});

describe("retryUnlessRateLimited", () => {
  it("ne retente jamais un refus de débit", () => {
    expect(retryUnlessRateLimited(0, { status: 429 })).toBe(false);
  });

  it("garde UNE tentative de rattrapage pour le reste", () => {
    expect(retryUnlessRateLimited(0, { status: 503 })).toBe(true);
    expect(retryUnlessRateLimited(1, { status: 503 })).toBe(false);
  });
});
