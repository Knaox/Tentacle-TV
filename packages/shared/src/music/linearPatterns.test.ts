/**
 * Les expressions réécrites pour CodeQL `js/polynomial-redos` : MÊMES résultats que les anciennes (comparées ici
 * sur des chaînes tirées au hasard dans un alphabet qui les met à l'épreuve), et en temps linéaire sur les
 * chaînes qui les rendaient quadratiques.
 */

import { describe, expect, it } from "vitest";
import { albumNotesOf } from "./albumNotes";
import { creditNames, matchText, sameAlbumTitle, withoutEditionGroups } from "./musicLibraryMatch";
import { playlistShareUrl } from "./musicShare";
import { absoluteSourceUrl } from "../octave/engine/engineShared";
import { trailingCodec } from "../player/trackDescription";

// Les anciennes expressions, telles qu'elles étaient.
const OLD_EDITION_GROUP = /\s*[([][^)\]]*\b(?:deluxe|edition|expanded|explicit|clean|bonus|anniversary|special|collectors?|remaster(?:ed)?)\b[^)\]]*[)\]]/gi;
const OLD_CREDIT_SPLIT = /\s*(?:,|;|\/|&|\+|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bvs\.?)\s*/i;
const OLD_TRAILING = /[.,;:!?)\]]+$/;
const OLD_PAREN = /^(.*?)\s*\(([A-Za-z0-9_]+)\)$/;

/** Générateur déterministe (graine fixe) : la même suite à chaque passage. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function samples(tokens: readonly string[], count = 4000, seed = 7): string[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    const length = Math.floor(random() * 12);
    return Array.from({ length }, () => tokens[Math.floor(random() * tokens.length)]).join("");
  });
}

const FAST_MS = 1000;
function elapsed(run: () => unknown): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe("groupes d'édition d'un album", () => {
  it("même titre normalisé que l'ancienne expression", () => {
    for (const title of samples(["(", ")", "[", "]", " ", "\t", "a", "Deluxe", "edition", "x", "remastered", "é", "-"])) {
      expect(matchText(withoutEditionGroups(title)), JSON.stringify(title)).toBe(matchText(title.replace(OLD_EDITION_GROUP, " ")));
    }
    expect(sameAlbumTitle("Abbey Road (2019 Remaster)", "Abbey Road")).toBe(true);
    expect(sameAlbumTitle("Album [Deluxe] (Live)", "Album (Live)")).toBe(true);
    expect(sameAlbumTitle("Score (Original)", "Soundtrack")).toBe(false);
  });

  it("linéaire sur des espaces et des parenthèses sans fin", () => {
    expect(elapsed(() => withoutEditionGroups(`${" ".repeat(200_000)}x`))).toBeLessThan(FAST_MS);
    expect(elapsed(() => withoutEditionGroups(`(${"deluxe ".repeat(30_000)}`))).toBeLessThan(FAST_MS);
    expect(elapsed(() => withoutEditionGroups("(".repeat(200_000)))).toBeLessThan(FAST_MS);
  });
});

describe("noms d'un crédit", () => {
  it("mêmes noms que l'ancienne découpe", () => {
    for (const name of samples([" ", ",", ";", "/", "&", "+", "and", "feat.", "ft", "featuring", "with", "x", "vs.", "A", "Bo", "é"])) {
      const old = new Set([matchText(name), ...name.split(OLD_CREDIT_SPLIT).map(matchText)].filter(Boolean));
      expect(creditNames([{ name, mbid: null }]), JSON.stringify(name)).toEqual(old);
    }
  });

  it("linéaire sur une longue suite d'espaces", () => {
    expect(elapsed(() => creditNames([{ name: `a${" ".repeat(200_000)}b`, mbid: null }]))).toBeLessThan(FAST_MS);
  });
});

describe("ponctuation finale d'une adresse des notes", () => {
  it("mêmes lignes que l'ancienne expression", () => {
    for (const tail of samples([".", ",", ";", ":", "!", "?", ")", "]", "a", "/", "!a"])) {
      const url = `https://ex.org/${tail}`;
      const kept = url.replace(OLD_TRAILING, "");
      const segments = albumNotesOf({ description: `voir ${url}` })[0];
      expect(segments?.[1], JSON.stringify(url)).toEqual({ kind: "link", text: kept, url: kept });
    }
  });

  it("linéaire sur une longue suite de « ! »", () => {
    expect(elapsed(() => albumNotesOf({ description: `https://a.b/${"!".repeat(200_000)}a` }))).toBeLessThan(FAST_MS);
  });
});

describe("codec en fin de libellé d'une piste", () => {
  it("même découpe que l'ancienne expression", () => {
    for (const label of samples([" ", "\t", "\n", "(", ")", "AC3", "a", "-", "_", "é"])) {
      const old = OLD_PAREN.exec(label);
      expect(trailingCodec(label), JSON.stringify(label)).toEqual(old ? [old[1], old[2]] : null);
    }
  });

  it("linéaire sur une longue suite d'espaces", () => {
    expect(elapsed(() => trailingCodec(`a${" ".repeat(200_000)}b(AC3)`))).toBeLessThan(FAST_MS);
  });
});

describe("barres finales d'une adresse", () => {
  it("mêmes adresses qu'avec /\\/+$/", () => {
    for (const base of ["https://a.b", "https://a.b/", "https://a.b///", "https://a.b/p//", "", "/"]) {
      expect(playlistShareUrl(base, "T")).toBe(`${base.replace(/\/+$/, "")}/octave/share/T`);
      expect(absoluteSourceUrl("/api/x", base)).toBe(`${base.replace(/\/+$/, "")}/api/x`);
    }
  });

  it("linéaire sur une longue suite de « / »", () => {
    const base = `https://a.b${"/".repeat(200_000)}x`;
    expect(elapsed(() => playlistShareUrl(base, "T"))).toBeLessThan(FAST_MS);
    expect(elapsed(() => absoluteSourceUrl("/api/x", base))).toBeLessThan(FAST_MS);
  });
});
