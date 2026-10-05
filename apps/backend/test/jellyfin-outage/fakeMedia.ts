/**
 * Les médias du banc web, servis par le faux Jellyfin comme Jellyfin 10.11
 * les sert : un film synthétique de 3 min (H.264 640×360, deux pistes AAC,
 * « fra » en 1 et « eng » en 2), en lecture directe (requêtes partielles) et
 * en HLS (segments TS de 2 s, la piste demandée copiée) — fabriqués une fois
 * par le ffmpeg de la machine. La fiche, PlaybackInfo (`mode` : le fichier
 * ou le HLS), et chaque requête de média notée (session, piste, relance).
 */

import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { Transform } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { FakeJellyfin } from "./fakeJellyfin";

export const ITEM_ID = "f11af11af11af11af11af11af11af11a";
const RUNTIME_TICKS = 180 * 10_000_000;

export interface MediaHit {
  at: number;
  kind: "static" | "master" | "variant" | "segment" | "playbackinfo";
  query: URLSearchParams;
}

const streams = (defaultAudio: number) => [
  { Codec: "h264", Type: "Video", Index: 0, Width: 640, Height: 360, BitRate: 1_000_000, IsDefault: true, Profile: "High", Level: 30, PixelFormat: "yuv420p", VideoRange: "SDR", VideoRangeType: "SDR", AverageFrameRate: 25, RealFrameRate: 25, BitDepth: 8, AspectRatio: "16:9", DisplayTitle: "360p H264 SDR" },
  { Codec: "aac", Type: "Audio", Index: 1, Language: "fra", Channels: 1, ChannelLayout: "mono", SampleRate: 48000, IsDefault: defaultAudio === 1, BitRate: 96_000, DisplayTitle: "Français - AAC - Mono" },
  { Codec: "aac", Type: "Audio", Index: 2, Language: "eng", Channels: 1, ChannelLayout: "mono", SampleRate: 48000, IsDefault: defaultAudio === 2, BitRate: 96_000, DisplayTitle: "English - AAC - Mono" },
];

export class FakeMedia {
  /** Ce que PlaybackInfo propose : le fichier tel quel, ou le HLS (transcodage). */
  mode: "direct" | "transcode" = "direct";
  /** La piste audio marquée par défaut (1 « fra », 2 « eng ») : celle que le lecteur demandera. */
  defaultAudio = 1;
  /**
   * Un réseau, pas un disque local : sans bride, le lecteur met tout le film
   * en réserve et ne cale jamais pendant la panne — la reprise n'est alors
   * pas éprouvée. Débit du fichier (octets/s) et délai par segment HLS de 2 s.
   */
  throttle = { bytesPerSecond: 250_000, segmentDelayMs: 1_200 };
  readonly hits: MediaHit[] = [];
  private session = 0;

  constructor(private readonly dir: string) {}

  /** Fabrique le film et son HLS s'ils n'existent pas (≈ 10 s). */
  prepare(): void {
    mkdirSync(join(this.dir, "hls"), { recursive: true });
    const film = join(this.dir, "panne.mp4");
    if (!existsSync(film)) {
      run(["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
        "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000", "-t", "180", "-map", "0:v", "-map", "1:a", "-map", "2:a",
        "-c:v", "libx264", "-preset", "veryfast", "-g", "50", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "1",
        "-metadata:s:a:0", "language=fra", "-metadata:s:a:1", "language=eng", "-movflags", "+faststart", film]);
    }
    for (const audio of [1, 2]) {
      const list = join(this.dir, "hls", `a${audio}.m3u8`);
      if (existsSync(list)) continue;
      run(["-y", "-loglevel", "error", "-i", film, "-map", "0:v", "-map", `0:a:${audio - 1}`, "-c", "copy", "-f", "hls", "-hls_time", "2",
        "-hls_playlist_type", "vod", "-hls_segment_filename", join(this.dir, "hls", `a${audio}-%d.ts`), list]);
    }
  }

  install(fake: FakeJellyfin): void {
    fake.extra = (method, url, req, res, body) => this.route(method, url, req, res, body);
  }

  private source(transcode: boolean, psid: string, audio: number): Record<string, unknown> {
    const base = {
      Id: ITEM_ID, Protocol: "File", Path: "/media/panne.mp4", Type: "Default", Container: "mov,mp4,m4a,3gp,3g2,mj2",
      Size: statSync(join(this.dir, "panne.mp4")).size, Name: "panne", IsRemote: false, RunTimeTicks: RUNTIME_TICKS,
      SupportsTranscoding: true, SupportsDirectStream: !transcode, SupportsDirectPlay: !transcode, Bitrate: 1_200_000,
      MediaStreams: streams(this.defaultAudio), DefaultAudioStreamIndex: this.defaultAudio,
    };
    if (!transcode) return base;
    const query = `DeviceId=banc&MediaSourceId=${ITEM_ID}&PlaySessionId=${psid}&AudioStreamIndex=${audio}&VideoCodec=h264&AudioCodec=aac&TranscodeReasons=ContainerBitrateExceedsLimit&SegmentContainer=ts`;
    return { ...base, TranscodingUrl: `/videos/${ITEM_ID}/master.m3u8?${query}`, TranscodingSubProtocol: "hls", TranscodingContainer: "ts", TranscodeReasons: ["ContainerBitrateExceedsLimit"] };
  }

  private route(method: string, url: URL, req: IncomingMessage, res: ServerResponse, body: Record<string, unknown> | null): boolean {
    const path = url.pathname.toLowerCase();
    const at = Date.now();
    if (method === "POST" && path === `/items/${ITEM_ID}/playbackinfo`) {
      this.session += 1;
      const psid = `ps${this.session}`;
      const audio = Number(body?.AudioStreamIndex ?? url.searchParams.get("AudioStreamIndex") ?? 1) || 1;
      const query = new URLSearchParams({ PlaySessionId: psid, AudioStreamIndex: String(audio), StartTimeTicks: String(body?.StartTimeTicks ?? "") });
      this.hits.push({ at, kind: "playbackinfo", query });
      json(res, { MediaSources: [this.source(this.mode === "transcode", psid, audio)], PlaySessionId: psid });
      return true;
    }
    if (method === "GET" && new RegExp(`^/(users/[^/]+/)?items/${ITEM_ID}$`).test(path)) {
      json(res, {
        Id: ITEM_ID, Name: "Panne (banc)", Type: "Movie", MediaType: "Video", RunTimeTicks: RUNTIME_TICKS, Container: "mov,mp4,m4a,3gp,3g2,mj2",
        ImageTags: {}, BackdropImageTags: [], UserData: { PlaybackPositionTicks: 0, Played: false, IsFavorite: false, PlayCount: 0 },
        MediaSources: [this.source(false, "", 1)], MediaStreams: streams(this.defaultAudio),
      });
      return true;
    }
    // Ce que Jellyfin rend en TABLEAU (un objet y casse les hooks de la fiche).
    if (method === "GET" && new RegExp(`^/(users/[^/]+/)?items/${ITEM_ID}/(ancestors|specialfeatures|localtrailers)$`).test(path)) {
      json(res, []);
      return true;
    }
    if (path === `/videos/${ITEM_ID}/stream` || path === `/videos/${ITEM_ID}/stream.mp4`) {
      this.hits.push({ at, kind: "static", query: url.searchParams });
      sendFile(req, res, join(this.dir, "panne.mp4"), "video/mp4", this.throttle.bytesPerSecond);
      return true;
    }
    const audio = url.searchParams.get("AudioStreamIndex") === "2" ? 2 : 1;
    if (path === `/videos/${ITEM_ID}/master.m3u8`) {
      this.hits.push({ at, kind: "master", query: url.searchParams });
      res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
      res.end(`#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1300000,CODECS="avc1.64001e,mp4a.40.2",RESOLUTION=640x360\nmain.m3u8?${url.searchParams}\n`);
      return true;
    }
    if (path === `/videos/${ITEM_ID}/main.m3u8`) {
      this.hits.push({ at, kind: "variant", query: url.searchParams });
      const list = readFileSync(join(this.dir, "hls", `a${audio}.m3u8`), "utf8").replace(/^a\d-(\d+)\.ts$/gm, (_m, n) => `hls1/main/${n}.ts?${url.searchParams}`);
      res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
      res.end(list);
      return true;
    }
    const segment = new RegExp(`^/videos/${ITEM_ID}/hls1/main/(\\d+)\\.ts$`).exec(path);
    if (segment) {
      this.hits.push({ at, kind: "segment", query: url.searchParams });
      const file = join(this.dir, "hls", `a${audio}-${segment[1]}.ts`);
      setTimeout(() => { if (!res.destroyed) sendFile(req, res, file, "video/mp2t"); }, this.throttle.segmentDelayMs);
      return true;
    }
    return false;
  }
}

function run(args: string[]): void {
  const res = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`ffmpeg a échoué : ${res.stderr}`);
}

function json(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Bride un flux à `bps` octets par seconde. */
function throttled(bps: number): Transform {
  return new Transform({
    transform(chunk: Buffer, _enc, done) {
      setTimeout(() => done(null, chunk), (chunk.length / bps) * 1000);
    },
  });
}

/** Un fichier, requêtes partielles comprises (le `<video>` lit par plages), bridé si `bps`. */
function sendFile(req: IncomingMessage, res: ServerResponse, file: string, type: string, bps = 0): void {
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const size = statSync(file).size;
  const range = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range ?? ""));
  if (!range) {
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
    pipeTo(createReadStream(file, { highWaterMark: 16_384 }), res, bps);
    return;
  }
  const start = range[1] ? Number(range[1]) : 0;
  const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  res.writeHead(206, { "Content-Type": type, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" });
  pipeTo(createReadStream(file, { start, end, highWaterMark: 16_384 }), res, bps);
}

function pipeTo(source: NodeJS.ReadableStream, res: ServerResponse, bps: number): void {
  // Une connexion coupée (port fermé pendant la panne) ne doit pas laisser de lecteur de fichier ouvert.
  res.on("close", () => (source as unknown as { destroy(): void }).destroy());
  if (bps > 0) source.pipe(throttled(bps)).pipe(res);
  else source.pipe(res);
}
