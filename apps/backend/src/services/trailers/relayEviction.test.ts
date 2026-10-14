/**
 * La règle d'oubli du relais : au-delà des vidéos complètes permises, les
 * plus anciennes perdent leurs listes et gardent leur source (une extraction
 * YouTube évitée au retour) ; au-delà des sources permises, ou échues, elles
 * partent.
 */

import { describe, expect, it } from "vitest";
import { planEviction, type EvictionView } from "./relayEviction";

const NOW = 1_000_000;
const view = (lastUsed: number, full = true, validUntil = NOW + 3_600_000): EvictionView => ({ lastUsed, full, validUntil });

describe("planEviction", () => {
  it("sous les limites : rien ne bouge", () => {
    const entries = new Map([["a", view(1)], ["b", view(2)]]);
    expect(planEviction(entries, NOW, { full: 2, total: 5 })).toEqual({ slim: [], drop: [] });
  });

  it("trop de vidéos complètes : les plus anciennes sont réduites à leur source, jamais oubliées", () => {
    const entries = new Map([["old", view(1)], ["mid", view(2)], ["new", view(3)]]);
    expect(planEviction(entries, NOW, { full: 1, total: 5 })).toEqual({ slim: ["mid", "old"], drop: [] });
  });

  it("une source seule ne compte pas parmi les complètes", () => {
    const entries = new Map([["light", view(5, false)], ["a", view(1)], ["b", view(2)]]);
    expect(planEviction(entries, NOW, { full: 2, total: 5 })).toEqual({ slim: [], drop: [] });
  });

  it("trop de sources : les plus anciennes partent", () => {
    const entries = new Map([["a", view(1, false)], ["b", view(2, false)], ["c", view(3, false)]]);
    expect(planEviction(entries, NOW, { full: 1, total: 2 })).toEqual({ slim: [], drop: ["a"] });
  });

  it("une source échue part toujours, même récente", () => {
    const entries = new Map([["dead", view(9, true, NOW)], ["live", view(1)]]);
    expect(planEviction(entries, NOW, { full: 5, total: 5 })).toEqual({ slim: [], drop: ["dead"] });
  });
});
