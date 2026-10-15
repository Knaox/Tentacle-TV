/**
 * La certification TMDB ramenée sur l'échelle de Jellyfin, et la décision pour un
 * compte restreint — calquées sur `GetRatingScore` et `IsParentalAllowed` (v10.11.11).
 */

import { describe, expect, it } from "vitest";
import { contentPolicyFromJellyfin } from "./contentPolicy";
import { restrictedAllows, scheduleAllows, scoreAllowed, tagsAllowed, titleScore, type TitleCertifications } from "./externalTitleRule";
import { ageOf, scoreCertification, stricter } from "./ratingTables";

const USER = "8f0c2f4a9e7b4d1c8a3b2c1d0e9f8a7b";
// La table que Jellyfin expose pour la France (extrait de `/Localization/ParentalRatings`).
const FR_LIVE = [
  { name: "TP", score: 0, subScore: null },
  { name: "10", score: 10, subScore: null },
  { name: "12", score: 12, subScore: null },
  { name: "16", score: 16, subScore: null },
  { name: "18", score: 18, subScore: null },
  { name: "X", score: 1000, subScore: null },
];
const FR = { metadataCountry: "FR", live: FR_LIVE };
const NONE = { metadataCountry: null, live: [] };

function movie(byCountry: Record<string, string[]>, extra: Partial<TitleCertifications> = {}): TitleCertifications {
  return { mediaType: "movie", adult: false, byCountry, keywords: [], ...extra };
}

describe("scoreCertification — l'échelle de Jellyfin (score = âge minimal)", () => {
  it.each([
    ["US", "G", 0, 0],
    ["US", "PG", 10, 0],
    ["US", "PG-13", 13, 0],
    ["US", "R", 17, 0],
    ["US", "NC-17", 17, 1],
    ["US", "TV-Y7-FV", 7, 1],
    ["US", "TV-MA", 17, 1],
    ["GB", "PG", 8, 0],
    ["GB", "12A", 12, 0],
    ["GB", "R18", 1000, 0],
    ["DE", "16", 16, null],
    ["AU", "MA15+", 15, null],
    ["AU", "X18+", 1000, null],
    ["JP", "PG12", 12, null],
    ["FI", "K-16", 16, null],
    ["PT", "M/14", 14, null],
    ["RU", "18+", 18, null],
    ["MX", "B-15", 15, null],
  ])("%s « %s » → %i", (country, cert, score, subScore) => {
    expect(scoreCertification(country, cert, NONE)).toEqual({ score, subScore });
  });

  it("la table VIVANTE de Jellyfin passe en tête pour son pays de métadonnées", () => {
    const live = [{ name: "U", score: 3, subScore: null }];
    expect(scoreCertification("FR", "U", { metadataCountry: "FR", live })).toEqual({ score: 3, subScore: null });
    expect(scoreCertification("FR", "U", NONE)).toEqual({ score: 0, subScore: null });
  });

  it("un âge lisible d'un pays sans table, le repli américain, sinon rien", () => {
    expect(scoreCertification("PL", "15", NONE)).toEqual({ score: 15, subScore: null });
    expect(scoreCertification("TW", "12+", NONE)).toEqual({ score: 12, subScore: null });
    expect(scoreCertification("ZZ", "PG-13", NONE)?.score).toBe(13);
    // Âge lisible et table américaine se départagent au plus strict.
    expect(scoreCertification("ZZ", "NC-17", NONE)).toEqual({ score: 17, subScore: 1 });
    expect(scoreCertification("ZZ", "Kinderfreundlich", NONE)).toBeNull();
  });

  it("non classé, exempté : inconnu", () => {
    for (const cert of ["NR", "Not Rated", "Unrated", "", "Exempt"]) expect(scoreCertification("US", cert, NONE)).toBeNull();
    expect(ageOf("99")).toBeNull();
  });

  it("le plus strict de deux scores, sous-score compris", () => {
    expect(stricter({ score: 12, subScore: 0 }, { score: 12, subScore: 1 })).toEqual({ score: 12, subScore: 1 });
    expect(stricter(null, { score: 6, subScore: null })).toEqual({ score: 6, subScore: null });
  });
});

describe("titleScore — le pays de métadonnées, puis les États-Unis", () => {
  it("le pays de métadonnées l'emporte, la plus stricte de ses sorties", () => {
    expect(titleScore(movie({ FR: ["U", "12"], US: ["R"] }), FR)).toEqual({ score: 12, subScore: null });
  });

  it("sans lui, les États-Unis ; un FILM sans l'un ni l'autre n'a pas de score", () => {
    expect(titleScore(movie({ US: ["PG-13"], GB: ["15"] }), FR)).toEqual({ score: 13, subScore: 0 });
    expect(titleScore(movie({ GB: ["15"] }), FR)).toBeNull();
  });

  it("un pays présent sans classification lisible arrête la recherche (comme Jellyfin : « FR-NR » = non classé)", () => {
    // Planet Earth II et 31 Minutes, relevés chez TMDB au banc du contrôle parental.
    expect(titleScore({ mediaType: "tv", adult: false, byCountry: { FR: ["NR"], US: ["TV-G"], DE: ["0"] }, keywords: [] }, FR)).toBeNull();
    expect(titleScore({ mediaType: "tv", adult: false, byCountry: { US: ["NR"], BR: ["L"], MX: ["AA"] }, keywords: [] }, FR)).toBeNull();
    expect(titleScore(movie({ FR: ["Inconnue"], US: ["G"] }), FR)).toBeNull();
  });

  it("une SÉRIE sans l'un ni l'autre prend la plus stricte des autres", () => {
    const series: TitleCertifications = { mediaType: "tv", adult: false, byCountry: { GB: ["12"], DE: ["16"] }, keywords: [] };
    expect(titleScore(series, FR)).toEqual({ score: 16, subScore: null });
  });
});

describe("la décision", () => {
  const restricted12 = contentPolicyFromJellyfin(USER, { MaxParentalRating: 12 });
  const noon = new Date(2026, 9, 14, 12, 0);

  it("comme IsParentalAllowed : sous la note, à la note (sous-score), au-dessus", () => {
    expect(scoreAllowed({ score: 10, subScore: null }, restricted12)).toBe(true);
    expect(scoreAllowed({ score: 12, subScore: 3 }, restricted12)).toBe(true);
    expect(scoreAllowed({ score: 12, subScore: 1 }, { maxParentalRating: 12, maxParentalSubRating: 0 })).toBe(false);
    expect(scoreAllowed({ score: 13, subScore: 0 }, restricted12)).toBe(false);
  });

  it("un film « 12 » en France passe, « 16 » non, sans certification non plus", () => {
    expect(restrictedAllows(movie({ FR: ["12"] }), restricted12, FR, noon)).toBe(true);
    expect(restrictedAllows(movie({ FR: ["16"] }), restricted12, FR, noon)).toBe(false);
    expect(restrictedAllows(movie({}), restricted12, FR, noon)).toBe(false);
    expect(restrictedAllows(null, restricted12, FR, noon)).toBe(false);
  });

  it("`adult` et les scores adultes sont toujours cachés", () => {
    const all = contentPolicyFromJellyfin(USER, { BlockedTags: ["gore"] });
    expect(restrictedAllows(movie({ FR: ["TP"] }, { adult: true }), all, FR, noon)).toBe(false);
    expect(restrictedAllows(movie({ FR: ["X"] }), all, FR, noon)).toBe(false);
    expect(restrictedAllows(movie({ FR: ["18"] }), all, FR, noon)).toBe(true);
  });

  it("étiquettes : les mots-clés de TMDB, comme Jellyfin les pose", () => {
    expect(tagsAllowed(["Gore", "zombie"], { blockedTags: ["gore"], allowedTags: [] })).toBe(false);
    expect(tagsAllowed(["family"], { blockedTags: [], allowedTags: ["Family"] })).toBe(true);
    expect(tagsAllowed([], { blockedTags: [], allowedTags: ["family"] })).toBe(false);
  });

  it("plages horaires : aucune = toujours ; sinon l'heure locale doit y tomber", () => {
    expect(scheduleAllows({ accessSchedules: [] }, noon)).toBe(true);
    const weekend = { accessSchedules: [{ dayOfWeek: "Weekend" as const, startHour: 9, endHour: 20.5 }] };
    expect(scheduleAllows(weekend, new Date(2026, 9, 17, 20, 15))).toBe(true); // samedi 20 h 15
    expect(scheduleAllows(weekend, new Date(2026, 9, 17, 21, 0))).toBe(false);
    expect(scheduleAllows(weekend, noon)).toBe(false); // mercredi
    // Bornes INCLUSES des deux côtés, comme Jellyfin (h ≥ début et h ≤ fin).
    const morning = { accessSchedules: [{ dayOfWeek: "Wednesday" as const, startHour: 8, endHour: 12 }] };
    expect(scheduleAllows(morning, new Date(2026, 9, 14, 8, 0))).toBe(true);
    expect(scheduleAllows(morning, new Date(2026, 9, 14, 12, 0))).toBe(true);
    expect(scheduleAllows(morning, new Date(2026, 9, 14, 12, 1))).toBe(false);
    expect(scheduleAllows(morning, new Date(2026, 9, 14, 7, 59))).toBe(false);
    // Weekday : lundi → vendredi ; la plage « jamais » ne s'ouvre à aucune heure.
    expect(scheduleAllows({ accessSchedules: [{ dayOfWeek: "Weekday", startHour: 0, endHour: 24 }] }, noon)).toBe(true);
    expect(scheduleAllows({ accessSchedules: [{ dayOfWeek: "Sunday", startHour: 24, endHour: 24 }] }, new Date(2026, 9, 18, 23, 59))).toBe(false);
  });

  it("une politique illisible ne laisse rien passer", () => {
    const closed = { ...restricted12, readable: false };
    expect(restrictedAllows(movie({ FR: ["TP"] }), closed, FR, noon)).toBe(false);
  });
});
