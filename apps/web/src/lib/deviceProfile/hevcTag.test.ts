import { afterEach, describe, expect, it, vi } from "vitest";
import { hevcConditions } from "./blocks";
import { decodesWithAvFoundation } from "./codecs";

/** Des agents de la forme que chaque moteur annonce (les versions ne comptent pas). */
const UA = {
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1",
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
  electron: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TentacleTV/1.22.0 Chrome/140.0.0.0 Electron/43.0.0 Safari/537.36",
} as const;

const withAgent = (userAgent: string) => vi.stubGlobal("navigator", { userAgent });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decodesWithAvFoundation — le <video> qui exige hvc1", () => {
  it("Safari sur Mac, iPhone et iPad (qui se présente en Mac)", () => {
    withAgent(UA.safariMac);
    expect(decodesWithAvFoundation()).toBe(true);
    withAgent(UA.safariIphone);
    expect(decodesWithAvFoundation()).toBe(true);
  });

  it("tout navigateur iOS : Chrome y est un WebKit", () => {
    withAgent(UA.chromeIphone);
    expect(decodesWithAvFoundation()).toBe(true);
  });

  it("ni Chromium (Chrome, Edge, Android, la coquille Electron), ni Firefox", () => {
    for (const agent of [UA.chromeMac, UA.edgeWindows, UA.chromeAndroid, UA.electron, UA.firefoxMac]) {
      withAgent(agent);
      expect(decodesWithAvFoundation(), agent).toBe(false);
    }
  });

  it("sans navigateur (rendu serveur, tests) : non", () => {
    vi.stubGlobal("navigator", undefined);
    expect(decodesWithAvFoundation()).toBe(false);
  });
});

describe("hevcConditions — le profil HEVC envoyé à Jellyfin", () => {
  const ranges = ["Unknown", "SDR"];

  it("sous AVFoundation : l'étiquette hvc1 / dvh1 est exigée, l'inconnue comprise", () => {
    expect(hevcConditions(ranges, true)).toContainEqual({
      Condition: "EqualsAny", Property: "VideoCodecTag", Value: "hvc1|dvh1", IsRequired: true,
    });
  });

  it("ailleurs : aucune condition d'étiquette — Chromium lit le hev1", () => {
    expect(hevcConditions(ranges, false).some((c) => c.Property === "VideoCodecTag")).toBe(false);
  });

  it("le niveau, les trames de référence et les plages restent dans les deux cas", () => {
    for (const avFoundation of [true, false]) {
      const properties = hevcConditions(ranges, avFoundation).map((c) => c.Property);
      expect(properties).toEqual(expect.arrayContaining(["VideoLevel", "RefFrames", "VideoRangeType"]));
    }
  });
});
