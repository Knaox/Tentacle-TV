import { beforeEach, describe, expect, it, vi } from "vitest";
import { FULL_PLAYBACK_RIGHTS, type PlaybackRights } from "../../playback/playbackRights";

let rights: PlaybackRights = FULL_PLAYBACK_RIGHTS;
const sourceCalls: string[] = [];

vi.mock("../../services/playbackRights", async (importActual) => ({
  ...(await importActual<typeof import("../../services/playbackRights")>()),
  playbackRightsFor: async () => rights,
}));
vi.mock("./streamAccess", async (importActual) => ({
  ...(await importActual<typeof import("./streamAccess")>()),
  itemRefused: async (itemId: string) => itemId === "cache",
}));
vi.mock("../../middleware/auth", () => ({
  validateToken: async (token: string) => (token === "jeton-u" ? { ok: true, user: { userId: "u" } } : { ok: false }),
}));
vi.mock("./streamSource", () => ({
  streamSourceFacts: async (itemId: string) => {
    sourceCalls.push(itemId);
    return {
      MediaStreams: [
        { Type: "Video", Index: 0, Codec: itemId === "mpeg2" ? "mpeg2video" : "h264", Width: 1280, Height: 720, BitRate: 8_000_000 },
        { Type: "Audio", Index: 1, Codec: "aac", Channels: 2, BitRate: 128_000 },
      ],
    };
  },
}));

import { gatePlayback } from "./playbackGate";

const hls = "?VideoCodec=h264&AudioCodec=aac&AllowVideoStreamCopy=true&VideoBitrate=139616000&AudioBitrate=128000&api_key=jeton-u";
const gate = (path: string, query: string, lentKeyUser: string | null = null) =>
  gatePlayback({ path, query, token: "jeton-u", lentKeyUser, clientIp: "203.0.113.9" });
const queryOf = (outcome: Awaited<ReturnType<typeof gate>>) =>
  new URLSearchParams(outcome.kind === "pass" && outcome.query ? outcome.query.slice(1) : "");

beforeEach(() => {
  rights = FULL_PLAYBACK_RIGHTS;
  sourceCalls.length = 0;
});

describe("gatePlayback — la porte de la lecture", () => {
  it("un compte sans restriction passe tel quel, sans lire la source", async () => {
    expect(await gate("Videos/mpeg2/master.m3u8", hls)).toEqual({ kind: "pass" });
    expect(sourceCalls).toEqual([]);
  });

  it("hors d'un flux ou d'un PlaybackInfo : rien à juger", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, mediaPlayback: false };
    expect(await gate("Items/abc", "")).toEqual({ kind: "pass" });
    expect(await gate("Videos/abc/Trickplay/320/0.jpg", "")).toEqual({ kind: "pass" });
  });

  it("un titre caché reste un 404, avant tout droit", async () => {
    expect(await gate("Videos/cache/stream", "?static=true")).toEqual({ kind: "hidden" });
  });

  it("la lecture interdite : PlaybackInfo, fichier tel quel, sous-titres", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, mediaPlayback: false };
    for (const path of ["Items/abc/PlaybackInfo", "Videos/abc/stream", "Videos/abc/abc/Subtitles/2/0/Stream.vtt", "Audio/abc/universal"]) {
      expect(await gate(path, "?static=true")).toEqual({ kind: "refused", code: "playback_not_allowed" });
    }
  });

  it("sans conversion de l'image : le MPEG-2 refusé, le H.264 copié de force", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, videoTranscoding: false };
    expect(await gate("Videos/mpeg2/master.m3u8", hls)).toEqual({ kind: "refused", code: "conversion_not_allowed" });
    const passed = await gate("Videos/h264/master.m3u8", hls);
    expect(passed.kind).toBe("pass");
    expect(queryOf(passed).get("VideoCodec")).toBe("copy");
    expect(queryOf(passed).get("api_key")).toBe("jeton-u");
    expect(await gate("Videos/mpeg2/stream", "?static=true")).toEqual({ kind: "pass" });
  });

  it("sans changement de conteneur : un remux refusé, un réencodage permis", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, remuxing: false };
    expect(await gate("Videos/h264/master.m3u8", hls)).toEqual({ kind: "refused", code: "conversion_not_allowed" });
    expect((await gate("Videos/mpeg2/master.m3u8", hls)).kind).toBe("pass");
  });

  it("sans conversion du son : un son demandé autrement est refusé, la copie forcée sinon", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, audioTranscoding: false };
    expect(await gate("Videos/h264/main.m3u8", `${hls}&AllowAudioStreamCopy=false`)).toEqual({ kind: "refused", code: "conversion_not_allowed" });
    expect(queryOf(await gate("Videos/h264/main.m3u8", hls)).get("AudioCodec")).toBe("copy");
  });

  it("client distant plafonné : PlaybackInfo et flux converti bornés, jamais relevés", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, maxBitrate: 2_000_000 };
    expect(queryOf(await gate("Items/abc/PlaybackInfo", "?MaxStreamingBitrate=120000000")).get("MaxStreamingBitrate")).toBe("2000000");
    expect(queryOf(await gate("Items/abc/PlaybackInfo", "?MaxStreamingBitrate=1000000")).get("MaxStreamingBitrate")).toBe("1000000");
    const capped = queryOf(await gate("Videos/h264/master.m3u8", hls));
    expect(capped.get("VideoBitrate")).toBe(String(2_000_000 - 128_000));
    expect(capped.get("MaxStreamingBitrate")).toBe("2000000");
    // Le fichier tel quel n'est pas plafonné (Jellyfin non plus) : le lecteur choisit un palier.
    expect(await gate("Videos/h264/stream", "?static=true")).toEqual({ kind: "pass" });
  });

  it("plafond ET image sans conversion : la copie trop lourde est refusée", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, maxBitrate: 2_000_000, videoTranscoding: false };
    expect(await gate("Videos/h264/master.m3u8", hls)).toEqual({ kind: "refused", code: "conversion_not_allowed" });
  });

  it("le compte d'un appareil est celui que le proxy a établi", async () => {
    rights = { ...FULL_PLAYBACK_RIGHTS, mediaPlayback: false };
    expect(await gatePlayback({ path: "Videos/abc/stream", query: "", token: "jwt-tv", lentKeyUser: "tv-user", clientIp: "1.1.1.1" }))
      .toEqual({ kind: "refused", code: "playback_not_allowed" });
    // Sans compte identifiable, Jellyfin décide seul.
    expect(await gatePlayback({ path: "Videos/abc/stream", query: "", token: "inconnu", lentKeyUser: null, clientIp: "1.1.1.1" }))
      .toEqual({ kind: "pass" });
  });
});
