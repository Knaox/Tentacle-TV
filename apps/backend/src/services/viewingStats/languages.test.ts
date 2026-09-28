import { describe, expect, it } from "vitest";
import { computePeriod } from "./computePeriod";
import { versionsFor } from "./listening";
import { H, NOW, cal, dataset, played, seg, title } from "../../../test/viewingStatsFixtures";

/**
 * Deux notions qu'on ne confond plus : d'où VIENNENT les titres (leur pays)
 * et ce que l'on ÉCOUTE (la piste audio lue). L'ancienne mesure pesait la
 * langue ORIGINALE des titres : à quelqu'un qui regarde tout en VF, elle
 * disait « 50 % en anglais, 20 % en allemand, 10 % en coréen ».
 */

const titles = [
  title("lost", "series", { origin: "US", originalLanguage: "en" }),
  title("dark", "series", { origin: "DE", originalLanguage: "de" }),
  title("squid", "series", { origin: "KR", originalLanguage: "ko" }),
  title("onepiece", "series", { origin: "JP", originalLanguage: "ja", anime: true }),
  title("kassos", "series", { origin: "FR", originalLanguage: "fr" }),
];

/** `n` séances de `seconds`, un jour chacune à partir du 1er septembre. */
function sessions(id: string, n: number, seconds: number, audioLang: string | null) {
  return Array.from({ length: n }, (_, i) =>
    seg(id, "episode", `2026-09-${String(i + 1).padStart(2, "0")}T19:00:00Z`, seconds, { itemId: `${id}-${i}`, audioLang })
  );
}

/** Le spectateur de l'utilisateur : tout en VF, sauf l'animé en VO japonaise. */
const allInFrench = () =>
  dataset(titles, [], [
    ...sessions("lost", 5, H, "fr"),
    ...sessions("dark", 2, H, "fr"),
    ...sessions("squid", 1, H, "fr"),
    ...sessions("onepiece", 3, 0.5 * H, "ja"),
    ...sessions("kassos", 10, 180, "fr"),
  ]);

describe("l'origine des titres", () => {
  it("dit le pays de production, pondéré par le temps — pas la langue écoutée", () => {
    const { origins } = computePeriod(allInFrench(), "30d", cal(), NOW);
    expect(origins.countries.map((c) => [c.key, Math.round(c.share * 100)])).toEqual([
      ["US", 50], ["DE", 20], ["JP", 15], ["KR", 10], ["FR", 5],
    ]);
    expect(origins.otherShare).toBe(0);
    expect(origins.unknownShare).toBe(0);
  });

  it("met le temps d'un titre sans fiche TMDB à « origine inconnue », sans rien deviner", () => {
    const data = dataset([title("dune", "movie", { origin: "US" }), title("mystery", "movie")], [
      played("dune", "movie", 3 * H, "2026-07-01T20:00:00Z"),
      played("mystery", "movie", H, "2026-07-02T20:00:00Z"),
    ]);
    const { origins } = computePeriod(data, "all", cal(), NOW);
    expect(origins.countries).toEqual([{ key: "US", seconds: 3 * H, share: 0.75 }]);
    expect(origins.unknownShare).toBeCloseTo(0.25);
  });
});

describe("VF ou VO ?", () => {
  it("entend du français là où l'ancienne mesure disait « anglais » — la preuve par le calcul", () => {
    const { listening } = computePeriod(allInFrench(), "30d", cal(), NOW);
    expect(listening.knownSeconds).toBe(10 * H);
    expect(listening.languages.map((l) => [l.key, Math.round(l.share * 100)])).toEqual([["fr", 85], ["ja", 15]]);
    // VF = français sur un titre qui ne l'est pas ; VO = la langue originale (One Piece en japonais, les Kassos en français).
    expect(versionsFor(listening, "fr")).toEqual({ original: 0.2, local: 0.8, otherDubs: 0 });
  });

  it("range l'anglais d'un animé dans les autres doublages en français, dans le doublage local en anglais", () => {
    const data = dataset(titles, [], [...sessions("onepiece", 4, H, "en"), ...sessions("lost", 2, H, "en")]);
    const { listening } = computePeriod(data, "30d", cal(), NOW);
    expect(versionsFor(listening, "fr")).toEqual({ original: 2 / 6, local: 0, otherDubs: 4 / 6 });
    expect(versionsFor(listening, "en")).toEqual({ original: 2 / 6, local: 4 / 6, otherDubs: 0 });
  });

  it("ne montre aucune part sous l'échantillon minimal : 3 h et 5 séances relevées", () => {
    const fewSessions = computePeriod(dataset(titles, [], sessions("lost", 2, 2 * H, "fr")), "30d", cal(), NOW).listening;
    expect(fewSessions).toMatchObject({ languages: [], knownSeconds: 4 * H, versionsReady: false });
    expect(versionsFor(fewSessions, "fr")).toBeNull();
    const fewHours = computePeriod(dataset(titles, [], sessions("lost", 6, 600, "fr")), "30d", cal(), NOW).listening;
    expect(fewHours).toMatchObject({ languages: [], knownSeconds: H, versionsReady: false });
  });

  it("ignore les séances d'avant le relevé, et sort de la base VF/VO un titre sans langue originale", () => {
    const data = dataset([...titles, title("mystery", "series")], [], [
      ...sessions("lost", 5, H, "fr"),
      ...sessions("dark", 5, H, null), // avant le relevé : la piste n'a pas été lue
      ...sessions("mystery", 5, H, "fr"), // pas de fiche TMDB : on ne sait pas si c'était la VO
    ]);
    const { listening } = computePeriod(data, "30d", cal(), NOW);
    expect(listening.knownSeconds).toBe(10 * H);
    expect(listening.languages).toEqual([{ key: "fr", seconds: 10 * H, share: 1 }]);
    expect(listening.versionSeconds).toBe(5 * H);
    expect(versionsFor(listening, "fr")).toEqual({ original: 0, local: 1, otherDubs: 0 });
  });
});
