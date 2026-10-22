import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/db", () => ({ getPrisma: () => ({}) }));

import { generateCode } from "./codes";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

describe("code de jumelage", () => {
  it("quatre caractères de l'alphabet sans ambiguïté (contrat des TV)", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
  });

  it("tire chaque caractère de façon uniforme (plus de modulo d'octet)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) for (const c of generateCode()) counts.set(c, (counts.get(c) ?? 0) + 1);
    // 40 000 tirages / 31 ≈ 1 290 attendus : l'ancien biais (9/256 contre
    // 8/256) donnait ~1 406 aux neuf premières lettres et ~1 250 aux autres.
    const first = [...ALPHABET.slice(0, 9)].reduce((sum, c) => sum + (counts.get(c) ?? 0), 0) / 9;
    const rest = [...ALPHABET.slice(9)].reduce((sum, c) => sum + (counts.get(c) ?? 0), 0) / 22;
    expect(counts.size).toBe(31);
    expect(first / rest).toBeLessThan(1.06);
  });
});
