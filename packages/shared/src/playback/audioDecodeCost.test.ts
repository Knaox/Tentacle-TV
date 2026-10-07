import { describe, expect, it } from "vitest";
import { audioCostCodec, audioDecodeCostPerMille } from "./audioDecodeCost";
import { LITE_AUDIO_DECODE_BUDGET } from "./litePlayback";

describe("audioCostCodec", () => {
  it("sépare le DTS à perte du DTS-HD MA / DTS:X sans perte", () => {
    expect(audioCostCodec({ Codec: "dts", Profile: "DTS" })).toBe("dts");
    expect(audioCostCodec({ Codec: "dts", Profile: "DTS-HD MA" })).toBe("dtshd");
    expect(audioCostCodec({ Codec: "dca", DisplayTitle: "English - DTS:X - 7.1" })).toBe("dtshd");
    expect(audioCostCodec({ Codec: "dts", Profile: "DTS-HD HRA" })).toBe("dts");
    expect(audioCostCodec({ Codec: "mlp" })).toBe("truehd");
  });
});

describe("audioDecodeCostPerMille (cœur d'A53)", () => {
  it("les sons à perte tiennent dans le budget Lite, en 5.1 comme en stéréo", () => {
    for (const Codec of ["aac", "ac3", "eac3", "dts", "mp3", "opus", "flac"]) {
      expect(audioDecodeCostPerMille({ Codec, Channels: 6, SampleRate: 48_000 })).toBeLessThanOrEqual(LITE_AUDIO_DECODE_BUDGET);
    }
  });

  it("le TrueHD et le DTS-HD MA 5.1 et plus le dépassent (~16 % d'un cœur et plus)", () => {
    expect(audioDecodeCostPerMille({ Codec: "truehd", Channels: 6, SampleRate: 48_000 })).toBe(156);
    expect(audioDecodeCostPerMille({ Codec: "truehd", Channels: 8, SampleRate: 48_000 })).toBe(208);
    expect(audioDecodeCostPerMille({ Codec: "dts", Profile: "DTS-HD MA", Channels: 8, SampleRate: 96_000 })).toBe(416);
  });

  it("un TrueHD stéréo reste sous le budget", () => {
    expect(audioDecodeCostPerMille({ Codec: "truehd", Channels: 2, SampleRate: 48_000 })).toBeLessThanOrEqual(LITE_AUDIO_DECODE_BUDGET);
  });

  it("canaux et fréquence inconnus : 5.1 à 48 kHz ; codec inconnu : compté comme le DTS", () => {
    expect(audioDecodeCostPerMille({ Codec: "truehd" })).toBe(156);
    expect(audioDecodeCostPerMille({ Codec: "inconnu", Channels: 6 })).toBe(audioDecodeCostPerMille({ Codec: "dts", Channels: 6 }));
  });
});
