import { describe, expect, it } from "vitest";
import { fitPreviewZoneSynopsis, synopsisSentenceEnds } from "./previewZoneSynopsis";

/**
 * Le synopsis vient des métadonnées du serveur : sa lecture reste LINÉAIRE
 * (CodeQL `js/polynomial-redos`) et rend ce que rendaient les anciennes regex.
 */

const ABBREVIATIONS = new Set(["m", "mm", "mme", "mmes", "mlle", "dr", "pr", "st", "ste", "mr", "mrs", "ms", "jr", "sr", "vs", "etc", "no", "vol", "ep", "cf"]);

/** L'ancienne lecture des fins de phrase, gardée comme référence. */
function legacySentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const pattern = /[.!?…]+["»”)]*(?=\s|$)/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    if (match[0].startsWith(".")) {
      const word = /([\p{L}]+)$/u.exec(text.slice(0, match.index))?.[1] ?? "";
      if (word.length === 1 || ABBREVIATIONS.has(word.toLowerCase())) continue;
    }
    const rest = text.slice(end).trimStart();
    if (rest.length > 0 && !/^[\p{Lu}\p{N}"«“(¿¡—–-]/u.test(rest)) continue;
    ends.push(end);
  }
  return ends;
}

/** L'ancienne coupe à une articulation (index du dernier début ≤ room). */
function legacyClauseCut(text: string, room: number): number {
  const pattern = /\s*[,;:]\s|\s[—–-]\s/g;
  let cut = -1;
  for (let match = pattern.exec(text); match && match.index <= room; match = pattern.exec(text)) cut = match.index;
  return cut;
}

function randomTexts(count: number): string[] {
  const alphabet = ["a", "Mr", "J", "é", "𝒜", "Le", " ", "  ", "\n", ".", "!", "?", "…", "\"", "»", ")", ",", ";", ":", "—", "-", "1", "«", "x"];
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: count }, () =>
    Array.from({ length: Math.floor(next() * 24) }, () => alphabet[Math.floor(next() * alphabet.length)]).join(""));
}

describe("synopsis — lecture linéaire", () => {
  it("rend les mêmes fins de phrase que l'ancienne regex", () => {
    for (const text of randomTexts(5000)) expect(synopsisSentenceEnds(text)).toEqual(legacySentenceEnds(text));
  });

  it("coupe à la même articulation que l'ancienne regex", () => {
    for (const raw of randomTexts(5000)) {
      const text = raw.trim();
      if (text.length < 4) continue;
      for (const budget of [2, Math.floor(text.length / 2), text.length - 1]) {
        if (budget <= 0 || synopsisSentenceEnds(text).some((end) => end <= budget)) continue;
        const cut = legacyClauseCut(text, budget - 1);
        const expected = cut >= budget * 0.5 ? `${text.slice(0, cut).trimEnd()}…` : null;
        expect(fitPreviewZoneSynopsis(text, budget)).toBe(expected);
      }
    }
  });

  it("lit un synopsis hostile en un instant", () => {
    const hostile = ["!".repeat(60_000), `a${" ".repeat(60_000)}b`, ".a".repeat(30_000)];
    for (const text of hostile) {
      const started = performance.now();
      synopsisSentenceEnds(text);
      fitPreviewZoneSynopsis(text, 10);
      expect(performance.now() - started).toBeLessThan(250);
    }
  });
});
