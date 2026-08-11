import { describe, it, expect } from "vitest";
import { classerRequete, debitEffectif } from "./journalNdjson.mjs";

describe("classerRequete", () => {
  it("distingue un segment de son manifeste sur la même route hls1", () => {
    expect(classerRequete("http://x/api/jellyfin/Videos/a/hls1/main/12.mp4")).toBe("segment");
    expect(classerRequete("http://x/api/jellyfin/Videos/a/hls1/main/main.m3u8")).toBe("manifeste");
  });

  it("ignore la requête, que Jellyfin charge de paramètres", () => {
    expect(classerRequete("http://x/Videos/a/hls1/main/12.mp4?PlaySessionId=1&api_key=2")).toBe("segment");
    expect(classerRequete("http://x/Videos/a/master.m3u8?DeviceId=tv")).toBe("manifeste");
  });

  it("reconnaît le flux progressif", () => {
    expect(classerRequete("http://x/Videos/a/stream.mp4?static=true")).toBe("flux");
    expect(classerRequete("http://x/Audio/a/universal")).toBe("flux");
  });

  it("range tout le reste à part", () => {
    expect(classerRequete("http://x/Items/a/Images/Primary")).toBe("autre");
    expect(classerRequete("")).toBe("autre");
    expect(classerRequete(undefined)).toBe("autre");
  });
});

describe("debitEffectif", () => {
  it("rend des mégabits par seconde", () => {
    // 12,5 Mo en 10 s = 10 Mb/s
    expect(debitEffectif(12_500_000, 10_000)).toBe(10);
  });

  it("arrondit au centième", () => {
    expect(debitEffectif(1_000_000, 1000)).toBe(8);
    expect(debitEffectif(1_234_567, 1000)).toBe(9.88);
  });

  it("refuse ce qui n'est pas mesurable plutôt que de rendre un chiffre faux", () => {
    expect(debitEffectif(0, 1000)).toBeNull();
    expect(debitEffectif(1000, 0)).toBeNull();
    expect(debitEffectif(1000, -5)).toBeNull();
    expect(debitEffectif(NaN, 1000)).toBeNull();
    expect(debitEffectif(undefined, undefined)).toBeNull();
  });
});
