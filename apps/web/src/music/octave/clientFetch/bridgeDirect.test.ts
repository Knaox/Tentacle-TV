import { describe, expect, it } from "vitest";
import { bridgeSource } from "../../engine/mpv/mpvAudioEngine";
import { testSource } from "../../engine/engineTestKit";

describe("requêtes déléguées — la source directe jusqu'au pont du bureau", () => {
  it("le flux direct accompagne la source du serveur, qui reste l'adresse de repli", () => {
    const direct = { url: "https://rr1.media.example.net/videoplayback?x=1", expiresAt: 123 };
    const out = bridgeSource({ ...testSource("/api/plugins/sillon/music/stream/a", "plugin"), direct }, "https://tentacle.example");
    expect(out.url).toBe("https://tentacle.example/api/plugins/sillon/music/stream/a");
    expect(out.direct).toEqual(direct);
  });

  it("sans flux direct, rien de plus qu'avant", () => {
    expect("direct" in bridgeSource(testSource("/api/music/stream/1"), "https://tentacle.example")).toBe(false);
  });
});
