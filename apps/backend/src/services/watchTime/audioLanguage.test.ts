import { describe, expect, it } from "vitest";
import { audioLanguageOf, canonicalLanguage } from "./audioLanguage";
import { normalize } from "./sessions";
import type { RawSession } from "./types";

/**
 * Ce que le spectateur ENTEND : la piste audio que le client dit jouer, lue
 * dans les flux de la source — jamais deviné quand plusieurs pistes existent
 * sans index rapporté.
 */

const vf = { Type: "Audio", Index: 1, Language: "fre" };
const vo = { Type: "Audio", Index: 2, Language: "eng" };
const video = { Type: "Video", Index: 0 };
const subs = { Type: "Subtitle", Index: 3, Language: "fre" };

describe("le code d'une langue", () => {
  it("ramène les formes ISO 639-2 aux deux lettres", () => {
    expect(canonicalLanguage("fre")).toBe("fr");
    expect(canonicalLanguage("fra")).toBe("fr");
    expect(canonicalLanguage("GER")).toBe("de");
    expect(canonicalLanguage("jpn")).toBe("ja");
    expect(canonicalLanguage("kor")).toBe("ko");
    expect(canonicalLanguage("swe")).toBe("sv");
  });

  it("garde la langue d'un code régional, et un code rare tel quel", () => {
    expect(canonicalLanguage("pt-BR")).toBe("pt");
    expect(canonicalLanguage("fr_CA")).toBe("fr");
    expect(canonicalLanguage("fil")).toBe("fil");
  });

  it("ne tire aucune langue d'un code muet ou absent", () => {
    for (const code of ["und", "mis", "zxx", "mul", "", "  ", null, undefined, "Français (France)"]) {
      expect(canonicalLanguage(code)).toBeNull();
    }
  });
});

describe("la piste audio lue", () => {
  it("suit l'index que le client rapporte — la VF d'un film américain s'entend en français", () => {
    expect(audioLanguageOf([video, vf, vo, subs], 1)).toBe("fr");
    expect(audioLanguageOf([video, vf, vo, subs], 2)).toBe("en");
  });

  it("n'emprunte jamais la langue d'un sous-titre ni d'une piste absente", () => {
    expect(audioLanguageOf([video, vf, subs], 3)).toBeNull();
    expect(audioLanguageOf([video, vf, vo], 7)).toBeNull();
  });

  it("sans index, lit une piste unique mais ne devine pas entre plusieurs", () => {
    expect(audioLanguageOf([video, vo], undefined)).toBe("en");
    expect(audioLanguageOf([video, vf, vo], undefined)).toBeNull();
    expect(audioLanguageOf([video, vf, vo], -1)).toBeNull();
    expect(audioLanguageOf(undefined, 1)).toBeNull();
  });
});

describe("le relevé d'une session", () => {
  const NOW = Date.parse("2026-09-29T20:00:00Z");
  const raw = (over: Partial<RawSession> = {}): RawSession => ({
    Id: "s1",
    UserId: "u1",
    Client: "Tentacle TV - Desktop",
    PlayState: { IsPaused: false, PositionTicks: 0, AudioStreamIndex: 1 },
    NowPlayingItem: { Id: "film1", Name: "Heat", Type: "Movie", RunTimeTicks: 10_000_000 * 3600, MediaStreams: [video, vf, vo] },
    ...over,
  });

  it("porte la langue entendue jusqu'à l'échantillon", () => {
    expect(normalize([raw()], NOW)[0].audioLang).toBe("fr");
  });

  it("la laisse inconnue quand Jellyfin ne joint pas les flux", () => {
    const [sample] = normalize([raw({ NowPlayingItem: { Id: "film1", Type: "Movie" } })], NOW);
    expect(sample.audioLang).toBeNull();
  });
});
