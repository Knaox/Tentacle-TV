/**
 * La route /api/playback/segments/:itemId de bout en bout : auth réelle
 * (Jellyfin bouchonné via le fetch global, comme test/downloads.test.ts),
 * résolution par le résolveur partagé, dégradation en 200 vide quand Jellyfin
 * ne répond plus.
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
  getConfigValue: (key: string) => (key === "admin_jellyfin_id" ? "admin-user-id" : undefined),
  isAudioAnalysisEnabled: () => true,
}));
const audioMocks = vi.hoisted(() => ({
  readStoredAudioVerdict: vi.fn(),
  needsAudioAnalysis: vi.fn(),
  enqueueAudioAnalysis: vi.fn(),
  audioAnalysisPending: vi.fn(),
}));
vi.mock("../services/audioAnalysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/audioAnalysis")>()),
  ...audioMocks,
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => false,
  getPrisma: () => {
    throw new Error("pas de prisma dans ce banc");
  },
}));

import { playbackSegmentRoutes } from "./playbackSegments";
import { clearSegmentSourceCache } from "../services/jellyfinSegments";

type Scenario = Array<[RegExp, { status?: number; json?: unknown } | "reject"]>;
let scenario: Scenario = [];

const USER = { Id: "u1", Name: "banc", Policy: { IsAdministrator: false } };

beforeEach(() => {
  clearSegmentSourceCache();
  scenario = [];
  audioMocks.readStoredAudioVerdict.mockReset().mockResolvedValue(undefined);
  audioMocks.needsAudioAnalysis.mockReset().mockReturnValue(false);
  audioMocks.enqueueAudioAnalysis.mockReset();
  audioMocks.audioAnalysisPending.mockReset().mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/Users/Me")) {
        return new Response(JSON.stringify(USER), { status: 200 });
      }
      for (const [pattern, response] of scenario) {
        if (!pattern.test(url)) continue;
        if (response === "reject") throw new Error("réseau coupé");
        return new Response(JSON.stringify(response.json ?? null), { status: response.status ?? 200 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeApp() {
  const app = Fastify();
  // Réplique du traitement central des ZodError (index.ts) — l'instance de
  // banc n'enregistre que la route testée.
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ message: "Validation error" });
    }
    const message = err instanceof Error ? err.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(playbackSegmentRoutes, { prefix: "/api/playback" });
  return app;
}

const request = async (itemId: string, withToken = true) => {
  const app = await makeApp();
  const response = await app.inject({
    method: "GET",
    url: `/api/playback/segments/${itemId}`,
    headers: withToken ? { "x-emby-token": "jeton-banc" } : {},
  });
  await app.close();
  return response;
};

/** 24 min en ticks, et un item avec chapitres optionnels. */
const RUNTIME_TICKS = 14_400_000_000;
const item = (chapters: Array<{ Name: string; StartPositionTicks: number }> = []) => ({
  Type: "Episode",
  RunTimeTicks: RUNTIME_TICKS,
  Chapters: chapters,
});
const nativeOutro = (endTicks: number) => ({
  Items: [{ Type: "Outro", StartTicks: 13_000_000_000, EndTicks: endTicks }],
});

describe("GET /api/playback/segments/:itemId", () => {
  it("refuse sans jeton", async () => {
    const response = await request("ep-anonyme", false);
    expect(response.statusCode).toBe(401);
  });

  it("rejette un identifiant hors format", async () => {
    const response = await request("ep_%00");
    expect(response.statusCode).toBe(400);
  });

  it("générique jusqu'au bout : endsAtMediaEnd, pas de scène après", async () => {
    scenario = [
      [/\/Items\//, { json: item() }],
      [/\/MediaSegments\//, { json: nativeOutro(RUNTIME_TICKS) }],
    ];
    const response = await request("ep-fin");
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=60");
    const body = response.json();
    expect(body).toMatchObject({ version: 1, itemId: "ep-fin", runtimeMs: 1_440_000 });
    expect(body.segments[0]).toMatchObject({
      type: "Outro",
      endsAtMediaEnd: true,
      hasContentAfter: false,
    });
  });

  it("générique coupé avant la fin : une scène suit", async () => {
    scenario = [
      [/\/Items\//, { json: item() }],
      [/\/MediaSegments\//, { json: nativeOutro(RUNTIME_TICKS - 600_000_000) }],
    ];
    const body = (await request("ep-scene")).json();
    expect(body.segments[0]).toMatchObject({
      type: "Outro",
      endsAtMediaEnd: false,
      hasContentAfter: true,
    });
  });

  it("aucun segment mais un chapitre nommé : repli chapitres", async () => {
    scenario = [
      [
        /\/Items\//,
        {
          json: item([
            { Name: "Épisode", StartPositionTicks: 0 },
            { Name: "Générique de fin", StartPositionTicks: 13_000_000_000 },
          ]),
        },
      ],
      [/\/MediaSegments\//, { json: { Items: [] } }],
      [/IntroSkipperSegments/, { status: 404 }],
      [/\/Timestamps$/, { status: 404 }],
    ];
    const body = (await request("ep-chapitre")).json();
    expect(body.segments[0]).toMatchObject({
      type: "Outro",
      source: "chapters",
      startMs: 1_300_000,
      endMs: 1_440_000,
    });
  });

  it("ni segment ni chapitre : rien — aucun repli statistique", async () => {
    scenario = [
      [/\/Items\//, { json: item() }],
      [/\/MediaSegments\//, { json: { Items: [] } }],
      [/IntroSkipperSegments/, { status: 404 }],
      [/\/Timestamps$/, { status: 404 }],
    ];
    const body = (await request("ep-nu")).json();
    expect(body.segments).toEqual([]);
  });

  it("Jellyfin muet : 200 et une réponse vide — le lecteur doit lire quand même", async () => {
    scenario = [[/jf\.test\/(Items|MediaSegments|Episode)/, "reject"]];
    const response = await request("ep-panne");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ version: 1, runtimeMs: 0, segments: [] });
  });
});

describe("l'analyse audio des voisins de saison", () => {
  const episode = () => ({
    ...item(),
    SeriesId: "series-1",
    SeasonId: "season-4",
    ParentIndexNumber: 4,
    IndexNumber: 3,
    MediaSources: [{ Id: "src-3", Bitrate: 8_000_000 }],
  });
  const bare = () => [
    [/\/MediaSegments\//, { json: { Items: [] } }],
    [/IntroSkipperSegments/, { status: 404 }],
    [/\/Timestamps$/, { status: 404 }],
  ] as Scenario;

  it("se met en file pour un épisode que personne n'a décrit, et le contrat se dit incomplet", async () => {
    scenario = [[/\/Items\//, { json: episode() }], ...bare()];
    audioMocks.needsAudioAnalysis.mockReturnValue(true);
    audioMocks.audioAnalysisPending.mockReturnValue(true);
    const response = await request("ep-audio");
    expect(audioMocks.enqueueAudioAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "ep-audio",
        runtimeMs: 1_440_000,
        mediaSourceId: "src-3",
        episode: expect.objectContaining({ seriesId: "series-1", seasonId: "season-4", indexNumber: 3 }),
        need: { head: true, tail: true },
        pluginInstalled: false,
        previousNeighbourKey: null,
        jellyfinUrl: "http://jf.test",
      }),
    );
    expect(response.json().analysisPending).toBe(true);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("un film n'est jamais mis en file", async () => {
    scenario = [[/\/Items\//, { json: { ...item(), Type: "Movie" } }], [/\/MediaSegments\//, { json: { Items: [] } }]];
    audioMocks.needsAudioAnalysis.mockReturnValue(true);
    await request("film-audio");
    expect(audioMocks.enqueueAudioAnalysis).not.toHaveBeenCalled();
  });

  it("un verdict rangé alimente le contrat, source audio, sans relancer quoi que ce soit", async () => {
    scenario = [[/\/Items\//, { json: episode() }], ...bare()];
    audioMocks.readStoredAudioVerdict.mockResolvedValue({
      verdict: {
        intro: { startMs: 140_000, endMs: 226_000, source: "audio" },
        outro: { startMs: 1_337_000, endMs: 1_440_000, source: "audio" },
        confirmedBy: 2,
        neighbourKey: "ep-2,ep-4",
      },
      createdAt: new Date(),
    });
    const response = await request("ep-verdict");
    const body = response.json();
    expect(body.segments.map((s: { type: string; source: string }) => [s.type, s.source])).toEqual([
      ["Intro", "audio"],
      ["Outro", "audio"],
    ]);
    expect(body.analysisPending).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("private, max-age=60");
    expect(audioMocks.enqueueAudioAnalysis).not.toHaveBeenCalled();
  });
});
