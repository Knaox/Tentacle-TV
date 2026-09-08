/**
 * Le palier `pmax` — qualité d'origine en MP4 — et la session de transcodage
 * choisie par le client. Deux ajouts pour le hors ligne mobile, additifs :
 * les paliers historiques ne changent pas d'un octet, et un client qui ne
 * choisit rien reçoit les identifiants du serveur comme avant.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../src/services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("no prisma in tests");
  },
}));

import { downloadRoutes } from "../src/routes/downloads";
import { clearPolicyCache } from "../src/services/jellyfinPolicy";
import { fakeJellyfin, ITEM_IN_A, streamCapture } from "./fakeJellyfinDownloads";

async function buildApp() {
  const app = Fastify();
  await app.register(downloadRoutes, { prefix: "/api/downloads" });
  return app;
}

/** L'URL amont, décodée : `URLSearchParams` encode les virgules des listes. */
const upstream = () => decodeURIComponent(streamCapture.lastUrl);

beforeEach(() => {
  clearPolicyCache();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    fakeJellyfin(input, init),
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("palier pmax — qualité d'origine en MP4", () => {
  it("copie la vidéo dans un MP4 classique, sans aucun plafond", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=pmax`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-tentacle-play-session"]).toBeTruthy();
    const url = upstream();
    expect(url).toContain("static=false");
    expect(url).toContain("container=mp4");
    expect(url).toContain("videoCodec=h264,hevc");
    // L'audio Dolby n'est JAMAIS copié sur ce palier : mesuré, la copie
    // rendait un fichier sans `moov`, donc illisible (cf. `downloads.ts`).
    expect(url).toContain("audioCodec=aac");
    expect(url).toContain("allowVideoStreamCopy=true");
    expect(url).toContain("allowAudioStreamCopy=true");
    // Et jamais `context=Static` : le client dépasse ffmpeg et reçoit un
    // fichier dont l'index n'a pas encore été écrit.
    expect(url).not.toContain("context=Static");
    // Un plafond, quel qu'il soit, ferait refuser la copie de flux.
    expect(url).not.toContain("videoBitRate");
    expect(url).not.toContain("audioBitRate");
    expect(url).not.toContain("maxHeight");
    expect(url).not.toContain("maxVideoBitDepth");
  });

  it("transmet la piste audio et l'incrustation, comme les autres paliers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=pmax&audioStreamIndex=2&burnSubtitleIndex=5`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(upstream()).toContain("audioStreamIndex=2");
    expect(upstream()).toContain("subtitleStreamIndex=5");
    expect(upstream()).toContain("subtitleMethod=Encode");
  });

  it("n'exige PAS le droit de conversion : il recopie l'image", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=pmax`,
      headers: { authorization: "Bearer tok-noconv" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("mais tombe sans aucun droit de transcodage de lecture", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=pmax`,
      headers: { authorization: "Bearer tok-nostream" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found" });
  });

  it("le même compte se voit toujours refuser un palier qui recompresse", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p720`,
      headers: { authorization: "Bearer tok-noconv" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("les paliers historiques ne changent pas d'un octet", async () => {
    const app = await buildApp();
    await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p720`,
      headers: { authorization: "Bearer tok-full" },
    });
    const url = upstream();
    expect(url).toContain("videoCodec=h264&");
    expect(url).toContain("audioCodec=aac&");
    expect(url).toContain("videoBitRate=4000000");
    expect(url).toContain("audioBitRate=160000");
    expect(url).toContain("maxHeight=720");
    expect(url).not.toContain("context=");
  });
});

describe("session de transcodage choisie par le client", () => {
  const PLAY = "0f0f0f0f-1111-2222-3333-444444444444";
  const DEVICE = "tentacle-dl-abcdef01";

  it("est honorée quand elle a la bonne forme, et renvoyée dans les en-têtes", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=pmax&playSessionId=${PLAY}&deviceId=${DEVICE}`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-tentacle-play-session"]).toBe(PLAY);
    expect(res.headers["x-tentacle-device-id"]).toBe(DEVICE);
    expect(upstream()).toContain(`playSessionId=${PLAY}`);
    expect(upstream()).toContain(`deviceId=${DEVICE}`);
  });

  it("une forme inattendue est ignorée : le serveur choisit", async () => {
    const app = await buildApp();
    const res = await app.inject({
      url: `/api/downloads/light/${ITEM_IN_A}?preset=p720&playSessionId=..%2Fevil&deviceId=pc-1`,
      headers: { authorization: "Bearer tok-full" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-tentacle-play-session"]).not.toBe("../evil");
    expect(res.headers["x-tentacle-device-id"]).toContain("tentacle-dl-");
    expect(upstream()).not.toContain("pc-1");
  });
});
