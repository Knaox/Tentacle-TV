import { describe, expect, it } from "vitest";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";
import { moodBackground, moodsNamedBy, shade } from "./moodModel";

const mood = (id: string, keywords: string[]): ExternalMusicMood => ({ id, name: id, color: "#2f6f8f", artworkUrl: null, keywords });
const MOODS = [
  mood("chill", ["détente", "chill", "relax", "lofi"]),
  mood("workout", ["sport", "running", "run", "gym"]),
  mood("sleep", ["sommeil", "dormir", "sleep"]),
  mood("roadtrip", ["road trip", "voiture"]),
];
const ids = (q: string) => moodsNamedBy(q, MOODS).map((m) => m.id);

describe("une recherche qui nomme une ambiance", () => {
  it("le mot lui-même, sans accents ni casse, mots de remplissage ôtés", () => {
    expect(ids("Chill")).toEqual(["chill"]);
    expect(ids("detente")).toEqual(["chill"]);
    expect(ids("musique pour dormir")).toEqual(["sleep"]);
    expect(ids("playlist road trip")).toEqual(["roadtrip"]);
  });
  it("contenu dans une recherche courte, début d'un mot", () => {
    expect(ids("chill sunday")).toEqual(["chill"]);
    expect(ids("détent")).toEqual(["chill"]);
    expect(ids("lo")).toEqual([]);
  });
  it("un titre long ne fait rien sortir ; une recherche sans rapport non plus", () => {
    expect(ids("running up that hill")).toEqual([]);
    expect(ids("daft punk")).toEqual([]);
    expect(ids("")).toEqual([]);
  });
});

describe("la teinte d'une carte", () => {
  it("assombrit vers le noir ; une couleur illisible rend l'encre", () => {
    expect(shade("#ffffff", 0.5)).toBe("#808080");
    expect(shade("bleu", 0.5)).toBe("#0e0b13");
    expect(moodBackground("#2f6f8f")).toBe("linear-gradient(135deg, #1c4356 0%, #2f6f8f 100%)");
  });
});
