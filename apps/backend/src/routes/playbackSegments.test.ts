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
}));
const tailMocks = vi.hoisted(() => ({
  readTailVerdict: vi.fn(),
  needsTailAnalysis: vi.fn(),
  startTailAnalysis: vi.fn(),
  tailAnalysisPending: vi.fn(),
}));
vi.mock("../services/tailAnalysis/tailAnalysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/tailAnalysis/tailAnalysis")>()),
  needsTailAnalysis: tailMocks.needsTailAnalysis,
  startTailAnalysis: tailMocks.startTailAnalysis,
  tailAnalysisPending: tailMocks.tailAnalysisPending,
}));
vi.mock("../services/tailAnalysis/tailStore", () => ({ readTailVerdict: tailMocks.readTailVerdict }));
// Les titres que les droits du compte lui cachent.
const hidden = vi.hoisted(() => new Set<string>());
vi.mock("../services/itemAccess/itemVisibility", () => ({
  isItemVisibleTo: async (_userId: string, itemId: string) => !hidden.has(itemId),
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
  tailMocks.readTailVerdict.mockReset().mockResolvedValue(undefined);
  tailMocks.needsTailAnalysis.mockReset().mockReturnValue(false);
  tailMocks.startTailAnalysis.mockReset();
  tailMocks.tailAnalysisPending.mockReset().mockReturnValue(false);
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

  it("un titre que les droits du compte lui cachent : la réponse vide, rien lu ni analysé en son nom", async () => {
    hidden.add("ep-interdit");
    scenario = [[/jf\.test\/(Items|MediaSegments|Episode)/, { status: 500 }]];
    const response = await request("ep-interdit");
    hidden.clear();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ version: 1, runtimeMs: 0, segments: [] });
    expect(tailMocks.startTailAnalysis).not.toHaveBeenCalled();
  });

  it("Jellyfin muet : 200 et une réponse vide — le lecteur doit lire quand même", async () => {
    scenario = [[/jf\.test\/(Items|MediaSegments|Episode)/, "reject"]];
    const response = await request("ep-panne");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ version: 1, runtimeMs: 0, segments: [] });
  });
});

describe("plus d'analyse audio", () => {
  it("un épisode que personne n'a décrit : aucun passage inventé, rien en attente", async () => {
    scenario = [
      [/\/Items\//, { json: { ...item(), SeriesId: "series-1", SeasonId: "season-4", MediaSources: [{ Id: "src-3" }] } }],
      [/\/MediaSegments\//, { json: { Items: [] } }],
      [/IntroSkipperSegments/, { status: 404 }],
      [/\/Timestamps$/, { status: 404 }],
    ];
    const response = await request("ep-sans-audio");
    expect(response.json().segments).toEqual([]);
    expect(response.json().analysisPending).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("private, max-age=60");
  });
});

describe("l'analyse de fin de média", () => {
  const film = () => ({
    ...item(),
    Type: "Movie",
    MediaSources: [{ Id: "src-film" }],
    Trickplay: { "src-film": { "320": { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 144, Interval: 10_000 } } },
  });

  it("part pour un film qui a des vignettes, avec les débuts annoncés par les fournisseurs", async () => {
    scenario = [[/\/Items\//, { json: film() }], [/\/MediaSegments\//, { json: nativeOutro(RUNTIME_TICKS) }]];
    tailMocks.needsTailAnalysis.mockReturnValue(true);
    tailMocks.tailAnalysisPending.mockReturnValue(true);
    const response = await request("film-fin");
    expect(tailMocks.needsTailAnalysis).toHaveBeenCalledWith("film-fin", 1_440_000, true, undefined);
    expect(tailMocks.startTailAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "film-fin",
        runtimeMs: 1_440_000,
        mediaSourceId: "src-film",
        providerSpans: [{ startMs: 1_300_000, endMs: 1_440_000 }],
        jellyfinUrl: "http://jf.test",
      }),
    );
    expect(response.json().analysisPending).toBe(true);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("un verdict rangé redessine le générique autour de la scène qu'il a trouvée", async () => {
    scenario = [[/\/Items\//, { json: film() }], [/\/MediaSegments\//, { json: nativeOutro(RUNTIME_TICKS) }]];
    tailMocks.readTailVerdict.mockResolvedValue({
      creditsStartMs: 1_300_000,
      scenes: [{ startMs: 1_400_000, endMs: 1_440_000 }],
      crawl: [1_310_000, 1_390_000],
      audio: true,
    });
    const body = (await request("film-scene")).json();
    expect(body.segments).toEqual([
      expect.objectContaining({ type: "Outro", source: "audio", startMs: 1_300_000, endMs: 1_399_000, hasContentAfter: true }),
    ]);
    expect(tailMocks.startTailAnalysis).not.toHaveBeenCalled();
  });
});
