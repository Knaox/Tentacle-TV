import { describe, expect, it } from "vitest";
import { pickDailymotionMaster } from "./dailymotionDirect";

const AUTO = "https://cdndirector.dailymotion.com/cdn/manifest/video/x8e90ff.m3u8?sec=abc";
const ADS = "https://dmxleo.dailymotion.com/cdn/manifest/video/x8e90ff.m3u8?ads=1";

describe("Dailymotion lu par le téléphone", () => {
  it("prend le maître sans publicité (qualities.auto), jamais advertising.ad_url", () => {
    expect(pickDailymotionMaster({
      qualities: { auto: [{ type: "application/x-mpegURL", url: AUTO }] },
      advertising: { ad_url: ADS },
    })).toBe(AUTO);
  });

  it("refuse une erreur, une vidéo protégée ou privée, un maître d'un autre hôte, un format inconnu", () => {
    expect(pickDailymotionMaster({ error: { code: 404, type: "not_found" } })).toBeNull();
    expect(pickDailymotionMaster({ is_password_protected: true, qualities: { auto: [{ url: AUTO }] } })).toBeNull();
    expect(pickDailymotionMaster({ private: true, qualities: { auto: [{ url: AUTO }] } })).toBeNull();
    expect(pickDailymotionMaster({ qualities: { auto: [{ url: "https://ailleurs.test/a.m3u8" }] } })).toBeNull();
    expect(pickDailymotionMaster({ qualities: { auto: [{ type: "video/mp4", url: AUTO }] } })).toBeNull();
    expect(pickDailymotionMaster(null)).toBeNull();
  });
});
