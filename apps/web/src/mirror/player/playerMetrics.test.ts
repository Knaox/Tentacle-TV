import { describe, expect, it } from "vitest";
import {
  centerGap, episodeCode, formatTime, isSwipeDown, parseTrackLabel, pctAt,
  playButtonSize, playerUiScale, tapSide, thumbSize, trackHeight,
} from "./playerMetrics";
import { armCountdown } from "./overlay/useArmedCountdown";

/** Les mesures recopiées de l'app : une divergence ici est une divergence à l'écran. */
describe("mesures du lecteur de l'app", () => {
  it("agrandit les contrôles de 1,4 sur tablette seulement", () => {
    expect(playerUiScale(false)).toBe(1);
    expect(playerUiScale(true)).toBe(1.4);
  });

  it("borne le bouton lecture à min(60 | 92, 0,08 × H)", () => {
    expect(playButtonSize(false, 844)).toBe(60);
    expect(playButtonSize(false, 390)).toBe(31);
    expect(playButtonSize(true, 1366)).toBe(92);
    expect(playButtonSize(true, 820)).toBe(66);
  });

  it("borne l'écart central à min(36 | 76, 0,05 × W)", () => {
    expect(centerGap(false, 390)).toBe(20);
    expect(centerGap(false, 844)).toBe(36);
    expect(centerGap(true, 1366)).toBe(68);
    expect(centerGap(true, 1600)).toBe(76);
  });

  it("dessine la piste en 4 (6 en glissé), ×1,6 sur tablette, pouce 14 / 20", () => {
    expect(trackHeight(false, false)).toBe(4);
    expect(trackHeight(true, false)).toBe(6);
    expect(trackHeight(false, true)).toBeCloseTo(6.4);
    expect(trackHeight(true, true)).toBeCloseTo(9.6);
    expect(thumbSize(false)).toBe(14);
    expect(thumbSize(true)).toBe(20);
  });
});

describe("temps et position", () => {
  it("formate comme la barre de l'app", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3723)).toBe("1:02:03");
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("borne la fraction sous le doigt", () => {
    expect(pctAt(50, 200)).toBe(0.25);
    expect(pctAt(-10, 200)).toBe(0);
    expect(pctAt(260, 200)).toBe(1);
    expect(pctAt(10, 0)).toBe(0);
  });
});

describe("gestes", () => {
  it("découpe l'écran en 35 % / 30 % / 35 % pour le double-tap", () => {
    expect(tapSide(100, 400)).toBe("left");
    expect(tapSide(200, 400)).toBe("center");
    expect(tapSide(300, 400)).toBe("right");
  });

  it("ne quitte que sur un balayage franc vers le bas", () => {
    expect(isSwipeDown(10, 150)).toBe(true);
    expect(isSwipeDown(0, 90)).toBe(false);
    expect(isSwipeDown(160, 150)).toBe(false);
    expect(isSwipeDown(0, -200)).toBe(false);
  });
});

describe("libellés", () => {
  it("écrit le code d'épisode sur deux chiffres", () => {
    expect(episodeCode(1, 2)).toBe("S01E02");
    expect(episodeCode(12, 104)).toBe("S12E104");
    expect(episodeCode(null, 2)).toBeNull();
  });

  it("sépare titre, langue et codec d'un libellé de piste", () => {
    expect(parseTrackLabel("French - AAC")).toEqual({ title: "French", lang: "FR", codec: "AAC" });
    expect(parseTrackLabel("English - Commentary")).toEqual({ title: "English - Commentary", lang: "EN", codec: null });
    expect(parseTrackLabel("Undetermined")).toEqual({ title: "Undetermined", lang: null, codec: null });
  });
});

describe("armement d'un décompte", () => {
  it("reprend le balayage où la carte l'avait laissé", () => {
    expect(armCountdown(6, 10_000)).toEqual({ remainingMs: 6000, initialProgress: 0.4, key: 10_000 });
  });

  it("part de zéro sans total connu", () => {
    expect(armCountdown(5, 0)).toEqual({ remainingMs: 5000, initialProgress: 0, key: 5000 });
  });
});
