import { expect } from "vitest";
import type { MediaItem } from "../../../../../packages/shared/src/types/media";
import { measureBitrate } from "../../../../../packages/api-client/src/jellyfin/bitrateMeasure";
import { check, feature } from "../harness";
import { firstUri, hevcSampleEntries, initUri, lastFfmpegLog } from "./hlsInspect";
import { pairedDeviceToken, tvHeaders } from "./pairedDevice";
import { AVFOUNDATION_PROFILE, DIRECT_PROFILE, H264_ONLY_PROFILE } from "./profiles";
import { bodySize, ctx, expectStatus, installedAppHeaders, proxy, tentacleClient } from "./support";

feature("playback.direct-play", () => {
  const { bbb } = ctx().fixtures.movies;

  check("PlaybackInfo (api-client) : lecture directe du fichier H.264/AAC", async () => {
    const info = await tentacleClient(ctx().user.token).getPlaybackInfo(bbb, { userId: ctx().user.id, deviceProfile: DIRECT_PROFILE });
    expect(info.MediaSources[0]?.SupportsDirectPlay).toBe(true);
    expect(info.PlaySessionId).toBeTruthy();
  });

  check("HEVC `hvc1` en MP4 : lecture directe sous la règle d'étiquette d'AVFoundation", async () => {
    const { hvc1 } = ctx().fixtures.hevc;
    const info = await tentacleClient(ctx().user.token).getPlaybackInfo(hvc1, { userId: ctx().user.id, deviceProfile: AVFOUNDATION_PROFILE });
    const ms = info.MediaSources[0]!;
    expect(ms.MediaStreams.find((s) => s.Type === "Video")?.CodecTag).toBe("hvc1");
    expect(ms.SupportsDirectPlay).toBe(true);
    expect(ms.TranscodingUrl).toBeFalsy();
  });

  check("flux du fichier par getStreamUrl, requête partielle respectée", async () => {
    const client = tentacleClient(ctx().user.token);
    const url = client.getStreamUrl(bbb, { mediaSourceId: bbb });
    const res = await fetch(url, { headers: { Range: "bytes=0-1023" } });
    expectStatus(res, 206);
    expect(await bodySize(res)).toBe(1024);
  });
});

feature("playback.transcode", () => {
  const { tears } = ctx().fixtures.movies;

  check("PlaybackInfo propose un transcodage HLS pour le HEVC d'un lecteur H.264", async () => {
    const info = await tentacleClient(ctx().user.token).getPlaybackInfo(tears, { userId: ctx().user.id, deviceProfile: H264_ONLY_PROFILE });
    expect(info.MediaSources[0]?.TranscodingUrl).toMatch(/\.m3u8/);
  });

  check("manifeste, variante et premier segment servis par le proxy", async () => {
    const info = await tentacleClient(ctx().user.token).getPlaybackInfo(tears, { userId: ctx().user.id, deviceProfile: H264_ONLY_PROFILE });
    const master = `${ctx().backend.url}/api/jellyfin${info.MediaSources[0]!.TranscodingUrl}`;
    const masterRes = await fetch(master);
    expectStatus(masterRes, 200);
    const variantUrl = firstUri(await masterRes.text(), master);
    const variantRes = await fetch(variantUrl);
    expectStatus(variantRes, 200);
    const segment = await fetch(firstUri(await variantRes.text(), variantUrl));
    expectStatus(segment, 200);
    expect(await bodySize(segment)).toBeGreaterThan(1000);
    await proxy(`Videos/ActiveEncodings?deviceId=${encodeURIComponent(client().getDeviceId())}&playSessionId=${info.PlaySessionId}`, {
      method: "DELETE", headers: installedAppHeaders(ctx().user.token),
    });
  }, { timeoutMs: 120_000 });

  check("un téléviseur jumelé ne reçoit jamais la clé admin (PlaybackInfo et manifeste)", async () => {
    const jwt = await pairedDeviceToken();
    const res = await proxy(`Items/${tears}/PlaybackInfo?UserId=${ctx().user.id}&IsPlayback=true&AutoOpenLiveStream=true`, {
      method: "POST",
      headers: { ...tvHeaders(jwt), "Content-Type": "application/json" },
      body: JSON.stringify({ DeviceProfile: H264_ONLY_PROFILE }),
    });
    const text = await res.text();
    expectStatus(res, 200);
    expect(text).not.toContain(ctx().apiKey);
    const info = JSON.parse(text) as { MediaSources: Array<{ TranscodingUrl?: string }>; PlaySessionId: string };
    const manifest = await (await fetch(`${ctx().backend.url}/api/jellyfin${info.MediaSources[0]!.TranscodingUrl}`)).text();
    expect(manifest).not.toContain(ctx().apiKey);
    expect(manifest).toContain("#EXTM3U");
  }, { timeoutMs: 120_000 });

  /** Remux d'un HEVC vers AVFoundation : manifeste, segment d'init, premier segment, journal ffmpeg. */
  const remuxForAvFoundation = async (itemId: string) => {
    const info = await tentacleClient(ctx().user.token).getPlaybackInfo(itemId, { userId: ctx().user.id, deviceProfile: AVFOUNDATION_PROFILE });
    const ms = info.MediaSources[0]!;
    expect(ms.SupportsDirectPlay && !ms.TranscodingUrl).toBe(false);
    const master = `${ctx().backend.url}/api/jellyfin${ms.TranscodingUrl}`;
    const variantUrl = firstUri(await (await fetch(master)).text(), master);
    const variant = await (await fetch(variantUrl)).text();
    const entries = hevcSampleEntries(await (await fetch(initUri(variant, variantUrl))).arrayBuffer());
    expectStatus(await fetch(firstUri(variant, variantUrl)), 200);
    const log = lastFfmpegLog(itemId);
    await proxy(`Videos/ActiveEncodings?deviceId=${encodeURIComponent(client().getDeviceId())}&playSessionId=${info.PlaySessionId}`, {
      method: "DELETE", headers: installedAppHeaders(ctx().user.token),
    });
    return { ms, url: new URL(master), entries, log };
  };

  check("HEVC `hev1` en MP4 : jamais en direct vers AVFoundation — remux, vidéo copiée et ré-étiquetée hvc1", async () => {
    const { hev1 } = ctx().fixtures.hevc;
    const { ms, url, entries, log } = await remuxForAvFoundation(hev1);
    expect(ms.MediaStreams.find((s) => s.Type === "Video")?.CodecTag).toBe("hev1");
    expect(url.searchParams.get("TranscodeReasons")).toBe("VideoCodecTagNotSupported");
    expect(entries).toEqual(["hvc1"]);
    expect(log.name).toMatch(/^FFmpeg\.Remux/);
    expect(log.command).toContain("-codec:v:0 copy");
    expect(log.command).toContain("-tag:v:0 hvc1");
  }, { timeoutMs: 120_000 });

  check("HEVC en MKV, sans étiquette : la vidéo reste copiée sous la règle d'étiquette (IsRequired)", async () => {
    const { mkv } = ctx().fixtures.hevc;
    const { ms, entries, log } = await remuxForAvFoundation(mkv);
    expect(ms.MediaStreams.find((s) => s.Type === "Video")?.CodecTag).toBeUndefined();
    expect(entries).toEqual(["hvc1"]);
    expect(log.command).toContain("-codec:v:0 copy");
  }, { timeoutMs: 120_000 });

  check("arrêt d'un transcodage (DELETE Videos/ActiveEncodings)", async () => {
    const res = await proxy(`Videos/ActiveEncodings?deviceId=compat-kill&playSessionId=compat-none`, {
      method: "DELETE", headers: installedAppHeaders(ctx().user.token),
    });
    expectStatus(res, 204, 200);
  });
});

const client = () => tentacleClient(ctx().user.token);

feature("playback.subtitles", () => {
  const { bbb, sintel } = ctx().fixtures.movies;

  const vttOf = async (itemId: string, pick: (item: MediaItem) => { msId: string; index: number } | null): Promise<string> => {
    const item = await client().fetch<MediaItem>(`/Users/${ctx().user.id}/Items/${itemId}?Fields=MediaSources,MediaStreams`);
    const target = pick(item);
    if (!target) throw new Error("piste de sous-titres introuvable");
    const res = await fetch(client().getSubtitleUrl(itemId, target.msId, target.index, "vtt"));
    expectStatus(res, 200);
    return res.text();
  };

  check("sous-titre intégré converti en WebVTT (getSubtitleUrl)", async () => {
    const vtt = await vttOf(bbb, (item) => {
      const ms = item.MediaSources?.[0];
      const sub = ms?.MediaStreams.find((s) => s.Type === "Subtitle");
      return ms && sub ? { msId: ms.Id, index: sub.Index } : null;
    });
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("Bonjour");
  });

  check("sous-titre externe (.fr.srt) converti en WebVTT", async () => {
    const vtt = await vttOf(sintel, (item) => {
      for (const ms of item.MediaSources ?? []) {
        const sub = ms.MediaStreams.find((s) => s.Type === "Subtitle" && s.IsExternal && s.Language?.startsWith("fr"));
        if (sub) return { msId: ms.Id, index: sub.Index };
      }
      return null;
    });
    expect(vtt).toContain("WEBVTT");
  });
});

feature("playback.bitrate", () => {
  check("mesure du débit par le proxy (measureBitrate)", async () => {
    const bps = await measureBitrate(client());
    expect(bps ?? 0).toBeGreaterThan(0);
  });
});
