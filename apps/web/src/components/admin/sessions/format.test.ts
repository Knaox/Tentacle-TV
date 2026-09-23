/**
 * Les mises en forme du tableau de bord des sessions, et la position vivante
 * qui fait avancer les barres entre deux instantanés.
 */

import { describe, expect, it } from "vitest";
import {
  acceleratorLabel, channelsLabel, codecLabel, formatBitrate, formatClock, humanizeReason, joinParts,
  livePositionTicks, rangeLabel, resolutionLabel,
} from "./format";

const TICKS = 10_000_000;

describe("format", () => {
  it("minutage : heures au-delà d'une heure seulement", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75 * TICKS)).toBe("1:15");
    expect(formatClock(3_725 * TICKS)).toBe("1:02:05");
  });

  it("débit à la française, kb/s sous le mégabit", () => {
    expect(formatBitrate(12_000_000, "fr")).toBe("12 Mb/s");
    expect(formatBitrate(4_500_000, "fr")).toBe("4,5 Mb/s");
    expect(formatBitrate(320_000, "fr")).toBe("320 kb/s");
    expect(formatBitrate(undefined, "fr")).toBeNull();
  });

  it("définition, codecs, plage, canaux, accélération", () => {
    expect(resolutionLabel(3840, 1608)).toBe("4K");
    expect(resolutionLabel(1920, 800)).toBe("1080p");
    expect(codecLabel("eac3")).toBe("Dolby Digital+");
    expect(codecLabel("xyz")).toBe("XYZ");
    expect(rangeLabel("SDR")).toBeNull();
    expect(rangeLabel("DOVIWithHDR10")).toBe("Dolby Vision");
    expect(channelsLabel(6)).toBe("5.1");
    expect(acceleratorLabel("none")).toBeNull();
    expect(acceleratorLabel("videotoolbox")).toBe("VideoToolbox");
  });

  it("une raison sans traduction reste lisible", () => {
    expect(humanizeReason("VideoCodecNotSupported")).toBe("Video codec not supported");
  });

  it("les éléments absents sont sautés", () => {
    expect(joinParts(["HEVC", null, "4K", "", undefined])).toBe("HEVC · 4K");
  });
});

describe("livePositionTicks", () => {
  it("avance avec l'horloge du serveur, bornée à la durée ; figée en pause", () => {
    // Serveur en avance de 1 s sur nous : à notre instant 10 000, il est 11 000.
    expect(livePositionTicks(100 * TICKS, 5_000, false, 10_000, 1_000)).toBe(106 * TICKS);
    expect(livePositionTicks(100 * TICKS, 5_000, false, 10_000, 1_000, 103 * TICKS)).toBe(103 * TICKS);
    expect(livePositionTicks(100 * TICKS, 5_000, true, 10_000, 1_000)).toBe(100 * TICKS);
  });
});
