import { describe, expect, it } from "vitest";
import { pluginOfTrack, withDirectFailed, withDirectSource, type DirectSourceDeps } from "./directSource";

/** Le flux direct d'un titre résolu par le téléphone : adopté seulement s'il est sûr, le serveur en repli. */

const NOW = 1_000_000;
const server = "https://tentacle.example/api/plugins/sillon/music/stream/ytm%3At%3Aabc";
const direct = { url: "https://rr1---sn-x.googlevideo.com/videoplayback?expire=1", expiresAt: NOW + 3_600_000 };
const deps = (over: Partial<DirectSourceDeps> = {}): DirectSourceDeps => ({ supported: () => true, mediaHosts: async () => ["*.googlevideo.com"], now: () => NOW, ...over });
const play = (source: object, trackKey = "ext:sillon:ytm:t:abc") => ({ track: { trackKey }, source, startMs: 0 });
const src = (extra: object = {}) => ({ url: server, origin: "plugin", complete: false, direct, ...extra });

describe("withDirectSource", () => {
  it("adopte le flux direct déclaré : url directe, ouverte sans en-têtes, repli marqué direct=failed", async () => {
    const out = await withDirectSource("audio_play", play(src()), deps());
    expect(out.source).toEqual({ url: direct.url, origin: "plugin", complete: false, open: "direct", fallbackUrl: `${server}?direct=failed` });
  });

  it("vaut aussi pour le suivant et l'échange de source", async () => {
    expect(((await withDirectSource("audio_set_next", play(src()), deps())).source as { open?: string }).open).toBe("direct");
    const swap = await withDirectSource("audio_swap_source", { trackKey: "ext:sillon:x", source: src() }, deps());
    expect((swap.source as { open?: string }).open).toBe("direct");
  });

  it("le serveur joue quand le module ne sait pas, l'hôte n'est pas déclaré, l'URL expire ou la source est de la bibliothèque", async () => {
    const cases = [
      await withDirectSource("audio_play", play(src()), deps({ supported: () => false })),
      await withDirectSource("audio_play", play(src()), deps({ mediaHosts: async () => ["cdn.example.com"] })),
      await withDirectSource("audio_play", play(src({ direct: { ...direct, expiresAt: NOW + 10_000 } })), deps()),
      await withDirectSource("audio_play", play(src({ origin: "library" })), deps()),
      await withDirectSource("audio_play", play(src(), "jf:123"), deps()),
      await withDirectSource("audio_play", play(src({ direct: { ...direct, url: "http://rr1.googlevideo.com/x" } })), deps()),
    ];
    for (const out of cases) {
      expect((out.source as { url: string }).url).toBe(server);
      expect(out.source).not.toHaveProperty("direct");
      expect(out.source).not.toHaveProperty("open");
    }
  });

  it("une source sans direct, ou une autre commande, passent telles quelles", async () => {
    const args = play({ url: server, origin: "plugin" });
    expect(await withDirectSource("audio_play", args, deps())).toBe(args);
    const control = { action: "pause" };
    expect(await withDirectSource("audio_control", control, deps())).toBe(control);
  });
});

describe("aides", () => {
  it("l'extension d'un titre, et le signal d'échec", () => {
    expect(pluginOfTrack("ext:sillon:ytm:t:abc")).toBe("sillon");
    expect(pluginOfTrack("jf:1")).toBeNull();
    expect(withDirectFailed("https://h/a?b=1")).toBe("https://h/a?b=1&direct=failed");
  });
});
