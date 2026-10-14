import { describe, expect, it } from "vitest";
import { pickDailymotionSource } from "./dailymotionSource";

const NOW = Date.UTC(2026, 9, 14, 14, 0);
const AUTO = "https://cdndirector.dailymotion.com/cdn/manifest/video/x8e90ff.m3u8?sec=abc&dmTs=1";
const ADS = "https://dmxleo.dailymotion.com/cdn/manifest/video/x8e90ff.m3u8?auth=pub";

/** Les champs utiles des métadonnées réelles du lecteur (« Rick et Morty - saison 6 Bande-annonce VF », 2026-10-14). */
const metadata = {
  id: "x8e90ff",
  title: "Rick et Morty - saison 6 Bande-annonce VF",
  duration: 27,
  partner: true,
  private: false,
  is_password_protected: false,
  advertising: { ad_url: ADS },
  qualities: { auto: [{ type: "application/x-mpegURL", url: AUTO }] },
  subtitles: { enable: false, data: [] },
};

describe("flux Dailymotion", () => {
  it("prend le maître SANS publicité (`qualities.auto`), jamais `advertising.ad_url`", () => {
    const result = pickDailymotionSource(metadata, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toEqual({ kind: "hls", masterUrl: AUTO, headers: {}, expiresAt: NOW + 3_600_000, heights: [] });
    expect(JSON.stringify(result)).not.toContain("dmxleo");
  });

  it("dit une vidéo absente pour de bon, et Dailymotion qui bride pour passager", () => {
    const missing = pickDailymotionSource({ error: { code: "404", type: "not_found" } }, NOW);
    expect(missing).toMatchObject({ ok: false, permanent: true });
    const limited = pickDailymotionSource({ error: { code: 429, type: "rate_limit" } }, NOW);
    expect(limited).toMatchObject({ ok: false, permanent: false, blocked: true });
  });

  it("refuse une vidéo protégée, ou un maître venu d'ailleurs", () => {
    expect(pickDailymotionSource({ ...metadata, is_password_protected: true }, NOW).ok).toBe(false);
    const elsewhere = { ...metadata, qualities: { auto: [{ type: "application/x-mpegURL", url: "https://evil.test/m.m3u8" }] } };
    expect(pickDailymotionSource(elsewhere, NOW).ok).toBe(false);
    expect(pickDailymotionSource("<html>", NOW).ok).toBe(false);
  });
});
