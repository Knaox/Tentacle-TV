import { describe, it, expect } from "vitest";
import { estUnRefusDeDebit, retenterSaufDebit } from "./retryPolicy";

describe("estUnRefusDeDebit", () => {
  it("reconnaît le status numérique d'une JellyfinError", () => {
    expect(estUnRefusDeDebit({ status: 429 })).toBe(true);
    expect(estUnRefusDeDebit({ status: 500 })).toBe(false);
  });

  it("reconnaît le corps d'erreur Fastify des enveloppes de fetch backend", () => {
    const corps = '{"statusCode":429,"error":"Too Many Requests","message":"Rate limit exceeded, retry in 1 minute"}';
    expect(estUnRefusDeDebit(new Error(corps))).toBe(true);
  });

  it("ne confond pas 429 avec un autre statut ni avec un nombre croisé au hasard", () => {
    expect(estUnRefusDeDebit(new Error('{"statusCode":4290}'))).toBe(false);
    expect(estUnRefusDeDebit(new Error("429 films trouvés"))).toBe(false);
    expect(estUnRefusDeDebit(null)).toBe(false);
    expect(estUnRefusDeDebit("429")).toBe(false);
  });
});

describe("retenterSaufDebit", () => {
  it("ne retente jamais un refus de débit", () => {
    expect(retenterSaufDebit(0, { status: 429 })).toBe(false);
  });

  it("garde UNE tentative de rattrapage pour le reste", () => {
    expect(retenterSaufDebit(0, { status: 503 })).toBe(true);
    expect(retenterSaufDebit(1, { status: 503 })).toBe(false);
  });
});
