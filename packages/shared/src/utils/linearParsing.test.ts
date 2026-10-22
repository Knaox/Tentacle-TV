import { describe, expect, it } from "vitest";
import i18next from "i18next";
import fr from "../i18n/locales/fr/common";
import { localExtraTitle } from "../extras/extraLabels";
import { shortPluginName } from "../search/pluginSearch";
import { tokenizeCueText } from "../subtitles/tags";
import { parseYouTubeId } from "../trailers/trailerList";

/**
 * Les lectures qu'une regex rendait quadratiques (CodeQL `js/polynomial-redos`)
 * et qui se font désormais à la main : MÊME résultat que l'ancienne regex sur
 * des chaînes tirées au hasard, et une entrée hostile lue en un instant.
 */

const LEGACY_WATCH = /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/;
const LEGACY_PLUGIN_SPLIT = /\s+[—–-]\s+/;

/** Générateur déterministe (LCG) : les tirages sont rejouables. */
function randomStrings(alphabet: string[], count: number, maxParts: number): string[] {
  let seed = 42;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: count }, () => {
    const parts = Math.floor(next() * maxParts);
    return Array.from({ length: parts }, () => alphabet[Math.floor(next() * alphabet.length)]).join("");
  });
}

/** Le temps d'un appel, en millisecondes. */
function elapsed(run: () => unknown): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

const HOSTILE = 60_000;

describe("parseYouTubeId — lien watch?", () => {
  it("rend ce que rendait l'ancienne regex", () => {
    const alphabet = ["youtube.com/watch?", "&", "v=", "abcdefghijk", "AAAAAAAAAAA", "x", "\n", "#", "&v=", "_-"];
    for (const url of randomStrings(alphabet, 4000, 10)) {
      if (/[?&]video_id=/.test(url)) continue;
      const legacy = LEGACY_WATCH.exec(url)?.[1] ?? null;
      const others = [/youtu\.be\/([\w-]{11})/, /youtube\.com\/embed\/([\w-]{11})/];
      const fallback = others.map((re) => re.exec(url)?.[1]).find(Boolean) ?? null;
      expect(parseYouTubeId(url)).toBe(legacy ?? fallback);
    }
  });

  it("lit un lien hostile en un instant", () => {
    const hostile = "youtube.com/watch?a".repeat(HOSTILE / 10);
    expect(elapsed(() => parseYouTubeId(hostile))).toBeLessThan(250);
  });
});

describe("shortPluginName", () => {
  it("rend ce que rendait l'ancien découpage", () => {
    const alphabet = [" ", "  ", "\t", "—", "–", "-", "Vigie", "x"];
    for (const name of randomStrings(alphabet, 4000, 9)) {
      const legacy = name.split(LEGACY_PLUGIN_SPLIT)[0]?.trim() || name;
      expect(shortPluginName(name)).toBe(legacy);
    }
  });

  it("lit un nom hostile en un instant", () => {
    const hostile = `a${" ".repeat(HOSTILE)}b`;
    expect(elapsed(() => shortPluginName(hostile))).toBeLessThan(250);
  });
});

describe("localExtraTitle — nom générique numéroté", () => {
  const i18n = i18next.createInstance();

  it("garde « Trailer 2 », et un nom hostile se lit en un instant", async () => {
    await i18n.init({ lng: "fr", resources: { fr: { common: fr } }, interpolation: { escapeValue: false } });
    expect(localExtraTitle(i18n.t, { Name: "Trailer  2", ExtraType: "Trailer" })).toBe("Bande-annonce 2");
    expect(localExtraTitle(i18n.t, { Name: "Trailer2", ExtraType: "Trailer" })).toBe("Trailer2");
    const hostile = `a${" ".repeat(HOSTILE)}b`;
    expect(elapsed(() => localExtraTitle(i18n.t, { Name: hostile, ExtraType: "Trailer" }))).toBeLessThan(250);
  });
});

describe("tokenizeCueText — ouvrants sans fermant", () => {
  it("garde les balises bien formées", () => {
    const cue = tokenizeCueText("<i>bonjour</i> {\\b1}toi{\\b0}");
    expect(cue.lines[0]?.map((s) => [s.text, !!s.italic, !!s.bold])).toEqual([
      ["bonjour", true, false],
      [" ", false, false],
      ["toi", false, true],
    ]);
  });

  it("lit une cue hostile en un instant", () => {
    expect(elapsed(() => tokenizeCueText("<".repeat(HOSTILE)))).toBeLessThan(250);
    expect(elapsed(() => tokenizeCueText("{".repeat(HOSTILE)))).toBeLessThan(250);
  });
});
