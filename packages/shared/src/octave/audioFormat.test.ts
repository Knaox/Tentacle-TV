import { describe, expect, it } from "vitest";
import { durationLabel, formatParts, totalDurationParts } from "./audioFormat";

const words = { bits: (n: number) => `${n} bits`, kbps: (n: number) => `${n} kb/s` };

describe("qualité affichée", () => {
  it("sans perte : profondeur et fréquence, haute résolution au-delà du CD", () => {
    const p = formatParts({ codec: "flac", container: "flac", sampleRate: 96_000, bitDepth: 24, bitrate: null, channels: 2, lossless: true }, "fr", words);
    expect(p).toEqual({ codec: "FLAC", detail: "24 bits · 96 kHz", lossless: true, hiRes: true });
    const cd = formatParts({ codec: "alac", container: "m4a", sampleRate: 44_100, bitDepth: 16, bitrate: null, channels: 2, lossless: true }, "fr", words);
    expect(cd.detail).toBe("16 bits · 44,1 kHz");
    expect(cd.hiRes).toBe(false);
  });

  it("avec perte : le débit, jamais une profondeur", () => {
    const p = formatParts({ codec: "mp3", container: "mp3", sampleRate: 44_100, bitDepth: null, bitrate: 320_000, channels: 2, lossless: false }, "en", words);
    expect(p).toEqual({ codec: "MP3", detail: "320 kb/s", lossless: false, hiRes: false });
  });

  it("un codec inconnu garde son nom, rien d'inventé", () => {
    const p = formatParts({ codec: "wavpack", container: null, sampleRate: null, bitDepth: null, bitrate: null, channels: null, lossless: true }, "fr", words);
    expect(p.codec).toBe("WAVPACK");
    expect(p.detail).toBeNull();
  });
});

describe("durées", () => {
  it("minutes:secondes, heures au besoin, tiret sans durée", () => {
    expect(durationLabel(187_400)).toBe("3:07");
    expect(durationLabel(3_729_000)).toBe("1:02:09");
    expect(durationLabel(null)).toBe("–:––");
    expect(totalDurationParts(4_320_000)).toEqual({ hours: 1, minutes: 12 });
  });
});
