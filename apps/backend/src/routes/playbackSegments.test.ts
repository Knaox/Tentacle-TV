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
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (valeur: string) => valeur,
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

const UTILISATEUR = { Id: "u1", Name: "banc", Policy: { IsAdministrator: false } };

beforeEach(() => {
  clearSegmentSourceCache();
  scenario = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entree: RequestInfo | URL) => {
      const url = String(entree);
      if (url.includes("/Users/Me")) {
        return new Response(JSON.stringify(UTILISATEUR), { status: 200 });
      }
      for (const [motif, reponse] of scenario) {
        if (!motif.test(url)) continue;
        if (reponse === "reject") throw new Error("réseau coupé");
        return new Response(JSON.stringify(reponse.json ?? null), { status: reponse.status ?? 200 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function creerApp() {
  const app = Fastify();
  // Réplique du traitement central des ZodError (index.ts) — l'instance de
  // banc n'enregistre que la route testée.
  app.setErrorHandler((erreur: unknown, _req, reply) => {
    if (erreur instanceof ZodError) {
      return reply.status(400).send({ message: "Validation error" });
    }
    const message = erreur instanceof Error ? erreur.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(playbackSegmentRoutes, { prefix: "/api/playback" });
  return app;
}

const demander = async (itemId: string, avecJeton = true) => {
  const app = await creerApp();
  const reponse = await app.inject({
    method: "GET",
    url: `/api/playback/segments/${itemId}`,
    headers: avecJeton ? { "x-emby-token": "jeton-banc" } : {},
  });
  await app.close();
  return reponse;
};

/** 24 min en ticks, et un item avec chapitres optionnels. */
const RUNTIME_TICKS = 14_400_000_000;
const item = (chapitres: Array<{ Name: string; StartPositionTicks: number }> = []) => ({
  Type: "Episode",
  RunTimeTicks: RUNTIME_TICKS,
  Chapters: chapitres,
});
const outroNatif = (endTicks: number) => ({
  Items: [{ Type: "Outro", StartTicks: 13_000_000_000, EndTicks: endTicks }],
});

describe("GET /api/playback/segments/:itemId", () => {
  it("refuse sans jeton", async () => {
    const reponse = await demander("ep-anonyme", false);
    expect(reponse.statusCode).toBe(401);
  });

  it("rejette un identifiant hors format", async () => {
    const reponse = await demander("ep_%00");
    expect(reponse.statusCode).toBe(400);
  });

  it("générique jusqu'au bout : endsAtMediaEnd, pas de scène après", async () => {
    scenario = [
      [/\/Items\//, { json: item() }],
      [/\/MediaSegments\//, { json: outroNatif(RUNTIME_TICKS) }],
    ];
    const reponse = await demander("ep-fin");
    expect(reponse.statusCode).toBe(200);
    expect(reponse.headers["cache-control"]).toBe("private, max-age=60");
    const corps = reponse.json();
    expect(corps).toMatchObject({ version: 1, itemId: "ep-fin", runtimeMs: 1_440_000 });
    expect(corps.segments[0]).toMatchObject({
      type: "Outro",
      endsAtMediaEnd: true,
      hasContentAfter: false,
    });
  });

  it("générique coupé avant la fin : une scène suit", async () => {
    scenario = [
      [/\/Items\//, { json: item() }],
      [/\/MediaSegments\//, { json: outroNatif(RUNTIME_TICKS - 600_000_000) }],
    ];
    const corps = (await demander("ep-scene")).json();
    expect(corps.segments[0]).toMatchObject({
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
    const corps = (await demander("ep-chapitre")).json();
    expect(corps.segments[0]).toMatchObject({
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
    const corps = (await demander("ep-nu")).json();
    expect(corps.segments).toEqual([]);
  });

  it("Jellyfin muet : 200 et une réponse vide — le lecteur doit lire quand même", async () => {
    scenario = [[/jf\.test\/(Items|MediaSegments|Episode)/, "reject"]];
    const reponse = await demander("ep-panne");
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toMatchObject({ version: 1, runtimeMs: 0, segments: [] });
  });
});
