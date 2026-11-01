import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isLoved } from "../lovedTaste";
import { computeTasteProfile } from "../profileCompute";
import { personaInputs } from "./benchPersona";
import type { BenchLibraryEntry, Persona } from "./benchPersona";

/**
 * Les personas « sans geste » et « maigre » du banc, par le VRAI calcul du
 * profil — sans bibliothèque relevée ni TMDB : une bibliothèque synthétique
 * faite de leurs titres, les facettes de repli de Jellyfin.
 */
const NOW = Date.parse("2026-11-01T12:00:00Z");
const PERSONAS = join(__dirname, "../../../../test/reco-bench/personas");
const WARMING_MIN = 5;
const READY_MIN = 15;
const EPISODES: Record<string, number> = { "tv:1396": 62, "tv:2316": 201, "tv:1399": 73 };

const load = (id: string) => JSON.parse(readFileSync(join(PERSONAS, `${id}.json`), "utf8")) as Persona;

function libraryOf(persona: Persona): BenchLibraryEntry[] {
  return persona.history.map((e, i) => {
    const [type, id] = e.key.split(":");
    const tv = type === "tv";
    return {
      itemId: `item${i}`, name: e.title ?? e.key, key: e.key, mediaType: tv ? "tv" : "movie", tmdbId: Number(id),
      hasPrimaryImage: true, hasBackdrop: true, communityRating: 8, Genres: [tv ? "Drame" : "Aventure"],
      ProductionYear: 2005, RunTimeTicks: (tv ? 30 : 140) * 600_000_000, episodeCount: EPISODES[e.key] ?? 0,
    };
  });
}

async function profileOf(id: string) {
  const persona = load(id);
  const inputs = personaInputs(persona, libraryOf(persona), NOW);
  return computeTasteProfile(
    { now: NOW, ratings: inputs.ratings, likes: inputs.likes, feedback: inputs.feedback, swipes: [], pendingWatchlist: [], signals: inputs.signals, measured: new Map() },
    { resolveMeta: async () => new Map(), idfFor: () => 1 }
  );
}

describe("banc pur : visionnages sans aucun geste", () => {
  it("tout ce qui a été regardé pèse, rien n'est un abandon", async () => {
    const { stored } = await profileOf("sans-geste");
    const byKey = new Map(stored.map((a) => [a.key, a]));
    for (const key of ["movie:120", "movie:121", "movie:155", "movie:27205"]) expect(byKey.get(key)?.kinds).toEqual(["completed"]);
    expect(byKey.get("movie:157336")?.kinds).toEqual(["partial"]);
    expect(byKey.get("tv:1396")?.kinds).toEqual(["series"]);
    expect(byKey.get("tv:2316")?.weight).toBeGreaterThan(0.4);
    expect(stored.some((a) => a.kinds.includes("abandon"))).toBe(false);
  });

  it("la série dévorée est adorée ; le profil est prêt", async () => {
    const { stored, signalCount } = await profileOf("sans-geste");
    expect(stored.find((a) => a.key === "tv:1396")?.traits).toContain("devoured");
    expect(stored.filter(isLoved).length).toBeGreaterThanOrEqual(1);
    expect(signalCount).toBeGreaterThanOrEqual(READY_MIN);
  });
});

describe("banc pur : profil maigre", () => {
  it("deux films et trois épisodes : au seuil du tiède, jamais « prêt »", async () => {
    const { stored, signalCount } = await profileOf("maigre");
    expect(stored).toHaveLength(3);
    expect(signalCount).toBeGreaterThanOrEqual(WARMING_MIN - 1);
    expect(signalCount).toBeLessThan(READY_MIN);
    expect(stored.filter(isLoved)).toHaveLength(0);
  });
});
