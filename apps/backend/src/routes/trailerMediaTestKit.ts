/**
 * Le banc des tests du relais des bandes-annonces (`trailerMedia*.test.ts`) :
 * une extraction et un googlevideo factices, le serveur et sa résolution. Les
 * `vi.mock` restent dans chaque fichier de test (vitest ne les remonte que
 * là) ; ce module n'est pas un test.
 */

import compress from "@fastify/compress";
import Fastify from "fastify";
import { vi } from "vitest";
import type { ExtractionResult } from "../services/trailers/ytExtract";
import { trailerRoutes } from "./trailers";
import { trailerMediaRoutes } from "./trailerMedia";

export const ID = "Way9Dexny3w";
export const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
export const masterUrl = (gen: number) => `https://manifest.googlevideo.test/api/manifest/hls_variant/expire/${FUTURE}/gen/${gen}/index.m3u8`;
export const timedtext = (gen: number, lang: string) => `https://www.youtube.com/api/timedtext?v=${ID}&gen=${gen}&lang=${lang}&fmt=json3`;
export const hls = (gen: number): ExtractionResult => ({
  ok: true,
  clients: ["visionos"],
  source: { kind: "hls", masterUrl: masterUrl(gen), headers: {}, expiresAt: FUTURE * 1000, heights: [1080, 720] },
  subtitles: [
    { key: "m-en", lang: "en", label: "English", auto: false, url: timedtext(gen, "en"), format: "json3" },
    { key: "a-fr", lang: "fr", label: "French", auto: true, url: timedtext(gen, "fr"), format: "json3" },
  ],
});

/** googlevideo factice, génération `gen` : les URL d'une extraction précédente répondent 403. */
export function googlevideo(gen: number) {
  const gv = `https://rr.googlevideo.test/gen/${gen}`;
  const pages: Record<string, string> = {
    [masterUrl(gen)]: [
      "#EXTM3U",
      `#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720\n${gv}/itag/95/v.m3u8`,
      `#EXT-X-STREAM-INF:BANDWIDTH=3295980,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080\n${gv}/itag/96/v.m3u8`,
    ].join("\n"),
    [timedtext(gen, "en")]: JSON.stringify({ events: [{ tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: "Hello <there>" }] }] }),
    [`${gv}/itag/95/v.m3u8`]: `#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\n${gv}/itag/95/sq/0.ts\n#EXT-X-ENDLIST\n`,
  };
  return vi.fn(async (url: string) => {
    if (url === `${gv}/itag/95/sq/0.ts`) return new Response(new Uint8Array([0x47, 1, 2, 3]), { headers: { "content-type": "video/mp2t" } });
    return url in pages ? new Response(pages[url]) : new Response("gone", { status: 403 });
  });
}

export async function server({ compressed = false } = {}) {
  const app = Fastify();
  // Comme le serveur (index.ts) : la compression globale, dès 1 Ko.
  if (compressed) await app.register(compress, { threshold: 1024 });
  await app.register(trailerRoutes, { prefix: "/api/trailers" });
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  return app;
}

/** Le chemin relayé que `/resolve` rend pour la vidéo du banc (jeton de LECTURE compris). */
export async function resolved(app: Awaited<ReturnType<typeof server>>) {
  const res = await app.inject({ url: `/api/trailers/resolve?ytId=${ID}`, headers: { authorization: "Bearer ok" } });
  return res.json().path as string;
}
