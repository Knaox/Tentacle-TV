import { describe, expect, it } from "vitest";
import { MPV_COPY_MAX_HEIGHT, mpvDecoderVerdict, parseMpvHwdec } from "./mpvDecoderGuard";

describe("parseMpvHwdec", () => {
  it("reconnaît les deux décodeurs matériels de mpv", () => {
    expect(parseMpvHwdec("mediacodec")).toBe("mediacodec");
    expect(parseMpvHwdec("mediacodec-copy")).toBe("mediacodec-copy");
    expect(parseMpvHwdec(" MediaCodec ")).toBe("mediacodec");
  });

  it("tout le reste est du logiciel : `no`, vide, absent, inconnu", () => {
    for (const value of ["no", "", null, undefined, "vaapi"]) expect(parseMpvHwdec(value)).toBe("software");
  });
});

describe("mpvDecoderVerdict", () => {
  it("mode normal : mpv garde la main quoi qu'il décode (comportement d'avant)", () => {
    for (const hwdec of ["mediacodec", "mediacodec-copy", "software"] as const) {
      expect(mpvDecoderVerdict({ lite: false, hwdec, videoHeight: 2160 })).toBe("keep");
    }
  });

  it("Lite : le décodage logiciel rend la main à Exo, même avant de connaître l'image", () => {
    expect(mpvDecoderVerdict({ lite: true, hwdec: "software", videoHeight: 0 })).toBe("toExo");
    expect(mpvDecoderVerdict({ lite: true, hwdec: "software", videoHeight: 720 })).toBe("toExo");
  });

  it("Lite : mediacodec (zéro copie) garde la main, en 4K comprise", () => {
    expect(mpvDecoderVerdict({ lite: true, hwdec: "mediacodec", videoHeight: 2160 })).toBe("keep");
  });

  it("Lite : mediacodec-copy jusqu'au 1080p seulement", () => {
    expect(mpvDecoderVerdict({ lite: true, hwdec: "mediacodec-copy", videoHeight: 1080 })).toBe("keep");
    expect(mpvDecoderVerdict({ lite: true, hwdec: "mediacodec-copy", videoHeight: MPV_COPY_MAX_HEIGHT })).toBe("keep");
    expect(mpvDecoderVerdict({ lite: true, hwdec: "mediacodec-copy", videoHeight: 1440 })).toBe("toExo");
    expect(mpvDecoderVerdict({ lite: true, hwdec: "mediacodec-copy", videoHeight: 2160 })).toBe("toExo");
  });
});
