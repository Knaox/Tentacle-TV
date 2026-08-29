/**
 * GET/PUT /api/preferences/playback : défauts sans ligne (signal de semis),
 * aller-retour d'écriture, bornes Zod, colonne farfelue normalisée. Prisma en
 * Map mémoire, auth réelle contre un faux /Users/Me (motif downloads.test.ts).
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeRow extends Record<string, unknown> {
  jellyfinUserId: string;
}
const rows = new Map<string, FakeRow>();

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    playbackSettings: {
      findUnique: async (args: { where: { jellyfinUserId: string } }) =>
        rows.get(args.where.jellyfinUserId) ?? null,
      upsert: async (args: {
        where: { jellyfinUserId: string };
        create: FakeRow;
        update: Record<string, unknown>;
      }) => {
        const existing = rows.get(args.where.jellyfinUserId);
        const row = existing ? { ...existing, ...args.update } : { ...args.create };
        rows.set(args.where.jellyfinUserId, row);
        return row;
      },
    },
  }),
}));

import { registerPlaybackSettingsRoutes } from "./preferences.playback";
import { requireAuth } from "../middleware/auth";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_COUNTDOWN_DEFAULT_MS,
} from "../playback/playbackSettings";

beforeEach(() => {
  rows.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/Users/Me")) {
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

async function makeApp() {
  const app = Fastify();
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ message: "Validation error" });
    }
    const message = err instanceof Error ? err.message : "Erreur";
    return reply.status(500).send({ message });
  });
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);
    registerPlaybackSettingsRoutes(scope);
  }, { prefix: "/api/preferences" });
  return app;
}

const headers = { "x-emby-token": "jeton-banc" };

/**
 * Ce qu'envoie un client d'AVANT la 1.20.9 : sans `nextCountdownMs`. Le laisser
 * ainsi est le test : sa requête doit passer, et le serveur poser le défaut.
 */
const VALID_SETTINGS = {
  intro: { action: "button", countdownVisible: false, autoDelayMs: 5_000 },
  outro: { action: "auto", countdownVisible: true, autoDelayMs: 2_000 },
  recap: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
  preview: { action: "off", countdownVisible: true, autoDelayMs: 3_000 },
  next: {
    nextCard: true,
    nextCountdown: false,
    nextAutoPlay: false,
    nextTrigger: "beforeEnd",
    beforeEndEnabled: true,
    beforeEndDefault: { mode: "seconds", value: 60 },
    beforeEndRules: [{ libraryIds: ["lib-series"], mode: "percent", value: 96 }],
  },
};

/** Ce que le serveur rend : les mêmes valeurs, plus le défaut du décompte. */
const STORED_SETTINGS = {
  ...VALID_SETTINGS,
  next: { ...VALID_SETTINGS.next, nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS },
};

describe("GET/PUT /api/preferences/playback", () => {
  it("refuse sans jeton", async () => {
    const app = await makeApp();
    const response = await app.inject({ method: "GET", url: "/api/preferences/playback" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("sans ligne : les défauts, et le signal de semis stored=false", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ stored: false, settings: DEFAULT_PLAYBACK_SETTINGS });
    await app.close();
  });

  it("PUT puis GET : l'aller-retour conserve tout, stored passe à true", async () => {
    const app = await makeApp();
    const written = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: headers,
      payload: VALID_SETTINGS,
    });
    expect(written.statusCode).toBe(200);
    expect(written.json()).toEqual({ stored: true, settings: STORED_SETTINGS });

    const readBack = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: headers,
    });
    expect(readBack.json()).toEqual({ stored: true, settings: STORED_SETTINGS });
    await app.close();
  });

  it("PUT hors bornes : 400, rien n'est écrit", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: headers,
      payload: {
        ...VALID_SETTINGS,
        intro: { ...VALID_SETTINGS.intro, autoDelayMs: 999_999 },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(rows.size).toBe(0);
    await app.close();
  });

  it("PUT avec une action inconnue : 400", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers: headers,
      payload: { ...VALID_SETTINGS, outro: { ...VALID_SETTINGS.outro, action: "banana" } },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("une colonne farfelue en base retombe sur son défaut à la lecture", async () => {
    rows.set("u1", {
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
    const app = await makeApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/preferences/playback",
      headers: headers,
    });
    expect(response.json().settings.intro.action).toBe("auto");
    await app.close();
  });
});

describe("le repli « avant la fin » traverse la base", () => {
  it("un seuil en pourcentage et ses règles ciblées reviennent intacts", async () => {
    const app = await makeApp();
    const settings = {
      ...VALID_SETTINGS,
      next: {
        ...VALID_SETTINGS.next,
        beforeEndDefault: { mode: "percent", value: 98 },
        beforeEndRules: [
          { libraryIds: ["series", "series-2"], mode: "percent", value: 96 },
          { libraryIds: ["anime"], mode: "seconds", value: 15 },
        ],
      },
    };
    await app.inject({ method: "PUT", url: "/api/preferences/playback", headers, payload: settings });
    const read = await app.inject({ method: "GET", url: "/api/preferences/playback", headers });
    expect(read.json()).toEqual({
      stored: true,
      settings: { ...settings, next: { ...settings.next, nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS } },
    });
  });

  it("un seuil hors bornes est refusé, pas rogné en silence", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers,
      payload: {
        ...VALID_SETTINGS,
        next: { ...VALID_SETTINGS.next, beforeEndDefault: { mode: "percent", value: 10 } },
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("une règle sans bibliothèque est refusée — elle ne s'appliquerait à rien", async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/preferences/playback",
      headers,
      payload: {
        ...VALID_SETTINGS,
        next: {
          ...VALID_SETTINGS.next,
          beforeEndRules: [{ libraryIds: [], mode: "percent", value: 90 }],
        },
      },
    });
    expect(response.statusCode).toBe(400);
  });
});
