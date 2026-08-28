/**
 * GET/PUT /api/preferences/playback : défauts sans ligne (signal de semis),
 * aller-retour d'écriture, bornes Zod, colonne farfelue normalisée. Prisma en
 * Map mémoire, auth réelle contre un faux /Users/Me (motif downloads.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FausseLigne extends Record<string, unknown> {
  jellyfinUserId: string;
}
const lignes = new Map<string, FausseLigne>();

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (valeur: string) => valeur,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    playbackSettings: {
      findUnique: async (args: { where: { jellyfinUserId: string } }) =>
        lignes.get(args.where.jellyfinUserId) ?? null,
      upsert: async (args: {
        where: { jellyfinUserId: string };
        create: FausseLigne;
        update: Record<string, unknown>;
      }) => {
        const existante = lignes.get(args.where.jellyfinUserId);
        const ligne = existante ? { ...existante, ...args.update } : { ...args.create };
        lignes.set(args.where.jellyfinUserId, ligne);
        return ligne;
      },
    },
  }),
}));

import { registerPlaybackSettingsRoutes } from "./preferences.playback";
import { requireAuth } from "../middleware/auth";
import { DEFAULT_PLAYBACK_SETTINGS } from "../playback/playbackSettings";

beforeEach(() => {
  lignes.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entree: RequestInfo | URL) => {
      if (String(entree).includes("/Users/Me")) {
        return new Response(
          JSON.stringify({ Id: "u1", Name: "banc", Policy: { IsAdministrator: false } }),
          { status: 200 },
        );
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
  app.setErrorHandler((erreur: unknown, _req, reply) => {
    if (erreur instanceof ZodError) {
      return reply.status(400).send({ message: "Validation error" });
    }
    const message = erreur instanceof Error ? erreur.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(async (portee) => {
    portee.addHook("preHandler", requireAuth);
    registerPlaybackSettingsRoutes(portee);
  }, { prefix: "/api/preferences" });
  return app;
}

const entetes = { "x-emby-token": "jeton-banc" };

const REGLAGES_VALIDES = {
  intro: { action: "button", countdownVisible: false, autoDelayMs: 5_000 },
  outro: { action: "auto", countdownVisible: true, autoDelayMs: 2_000 },
  recap: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
  preview: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
  next: {
    nextCard: true,
    nextCountdown: false,
    nextAutoPlay: false,
    nextTrigger: "beforeEnd",
    nextBeforeEndSeconds: 60,
  },
};

describe("GET/PUT /api/preferences/playback", () => {
  it("refuse sans jeton", async () => {
    const app = await creerApp();
    const reponse = await app.inject({ method: "GET", url: "/api/preferences/playback" });
    expect(reponse.statusCode).toBe(401);
    await app.close();
  });

  it("sans ligne : les défauts, et le signal de semis stored=false", async () => {
    const app = await creerApp();
    const reponse = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: entetes,
    });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS });
    await app.close();
  });

  it("PUT puis GET : l'aller-retour conserve tout, stored passe à true", async () => {
    const app = await creerApp();
    const ecriture = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: entetes,
      payload: REGLAGES_VALIDES,
    });
    expect(ecriture.statusCode).toBe(200);
    expect(ecriture.json()).toEqual({ stored: true, settings: REGLAGES_VALIDES });

    const relecture = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: entetes,
    });
    expect(relecture.json()).toEqual({ stored: true, settings: REGLAGES_VALIDES });
    await app.close();
  });

  it("PUT hors bornes : 400, rien n'est écrit", async () => {
    const app = await creerApp();
    const reponse = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: entetes,
      payload: {
        ...REGLAGES_VALIDES,
        intro: { ...REGLAGES_VALIDES.intro, autoDelayMs: 999_999 },
      },
    });
    expect(reponse.statusCode).toBe(400);
    expect(lignes.size).toBe(0);
    await app.close();
  });

  it("PUT avec une action inconnue : 400", async () => {
    const app = await creerApp();
    const reponse = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: entetes,
      payload: { ...REGLAGES_VALIDES, outro: { ...REGLAGES_VALIDES.outro, action: "banana" } },
    });
    expect(reponse.statusCode).toBe(400);
    await app.close();
  });

  it("une colonne farfelue en base retombe sur son défaut à la lecture", async () => {
    lignes.set("u1", {
      jellyfinUserId: "u1",
      introAction: "banana",
      introCountdown: true,
      introDelayMs: 3_000,
      outroAction: "button",
      outroCountdown: true,
      outroDelayMs: 3_000,
      recapAction: "off",
      recapCountdown: true,
      recapDelayMs: 3_000,
      previewAction: "off",
      previewCountdown: true,
      previewDelayMs: 3_000,
      nextCard: true,
      nextCountdown: true,
      nextAutoPlay: true,
      nextTrigger: "outroStart",
      nextBeforeEndSeconds: 45,
    });
    const app = await creerApp();
    const reponse = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: entetes,
    });
    expect(reponse.json().settings.intro.action).toBe("auto");
    await app.close();
  });
});
