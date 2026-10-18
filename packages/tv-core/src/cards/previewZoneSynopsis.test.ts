import { describe, expect, it } from "vitest";
import { fitPreviewZoneSynopsis as fit, synopsisBudget, synopsisSentenceEnds } from "./previewZoneSynopsis";
import { PREVIEW_ZONE_PLAYBACK, previewZoneWatching, previewZoneWatchingMs } from "./previewZonePlayback";

const TWO = "Un professeur de chimie apprend qu'il est malade. Il décide de fabriquer de la drogue pour sa famille.";

describe("fitPreviewZoneSynopsis — jamais un mot coupé", () => {
  it("le texte entier quand il tient", () => {
    expect(fit(TWO, TWO.length)).toBe(TWO);
    expect(fit(`  ${TWO}  `, TWO.length)).toBe(TWO);
  });

  it("les phrases entières qui tiennent, sans « … »", () => {
    expect(fit(TWO, TWO.length - 1)).toBe("Un professeur de chimie apprend qu'il est malade.");
  });

  it("une articulation de la première phrase, suivie de « … », si elle couvre la moitié de la place", () => {
    const long = "Walter White, professeur de chimie dans un lycée d'Albuquerque, apprend qu'il est atteint d'un cancer incurable.";
    expect(fit(long, 70)).toBe("Walter White, professeur de chimie dans un lycée d'Albuquerque…");
    // L'articulation trop tôt (« Walter White ») : rien plutôt qu'un bout.
    expect(fit(long, 40)).toBeNull();
  });

  it("un deux-points à la française et un tiret valent une articulation", () => {
    expect(fit("Une seule règle : ne jamais revenir — même pour elle, même si tout brûle derrière eux.", 50)).toBe("Une seule règle : ne jamais revenir…");
  });

  it("rien sans place ni texte", () => {
    expect(fit("", 100)).toBeNull();
    expect(fit(TWO, 0)).toBeNull();
  });
});

describe("synopsisSentenceEnds — les fins de phrase", () => {
  it("une abréviation ou une initiale ne finit pas une phrase", () => {
    const text = "M. Robot et J. Doe partent. Dr. House aussi.";
    expect(synopsisSentenceEnds(text)).toEqual([27, text.length]);
  });

  it("un point suivi d'une minuscule non plus ; les guillemets suivent la phrase", () => {
    expect(synopsisSentenceEnds("Il dit « non. » puis part. Fin")).toEqual([26]);
    expect(synopsisSentenceEnds("Une version 2.0 sort. Enfin !")).toEqual([21, 29]);
  });
});

describe("synopsisBudget — la place mesurée", () => {
  it("additionne les N premières lignes posées", () => {
    expect(synopsisBudget([40, 38, 41, 12], 2)).toBe(78);
    expect(synopsisBudget([40], 3)).toBe(40);
    expect(synopsisBudget([40, 38], 0)).toBe(0);
  });
});

describe("previewZoneWatching — la zone s'efface devant la vidéo", () => {
  it("seulement quand la vidéo se montre et joue", () => {
    expect(previewZoneWatching({ videoShown: true, paused: false })).toBe(true);
    expect(previewZoneWatching({ videoShown: true, paused: true })).toBe(false);
    expect(previewZoneWatching({ videoShown: false, paused: false })).toBe(false);
  });

  it("se retire plus posément qu'il ne revient", () => {
    expect(previewZoneWatchingMs(true)).toBe(PREVIEW_ZONE_PLAYBACK.recedeMs);
    expect(previewZoneWatchingMs(false)).toBeLessThan(previewZoneWatchingMs(true));
  });
});
