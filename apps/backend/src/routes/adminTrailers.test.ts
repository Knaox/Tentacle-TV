/**
 * La route admin des bandes-annonces : la case AlloCiné (absente = cochée),
 * grisée hors d'un serveur français, l'état des sources, et le refus d'un
 * non-admin. L'auth est réduite à « admin » ou non.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => new Map<string, string>());
vi.mock("../services/configStore", () => ({
  getConfigValue: (key: string) => config.get(key),
  setConfigValue: async (key: string, value: string) => void config.set(key, value),
  deleteConfigValue: async (key: string) => void config.delete(key),
}));
vi.mock("../middleware/auth", () => ({
  requireAdmin: async (request: { headers: Record<string, unknown> }, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) => {
    if (request.headers.authorization !== "Bearer admin") return reply.status(403).send({ message: "Forbidden" });
  },
}));

import { setTitleLanguage } from "../services/reco/titleLanguage";
import { resetYouTubeGuard, tripYouTubeBreaker } from "../services/trailers/youtubeGuard";
import { resetDailymotionGuard } from "../services/trailers/dailymotionGuard";
import { adminTrailersRoutes } from "./adminTrailers";

async function server() {
  const app = Fastify();
  await app.register(adminTrailersRoutes, { prefix: "/api/admin" });
  return app;
}

const read = async (token = "admin") =>
  (await server()).inject({ url: "/api/admin/trailers", headers: { authorization: `Bearer ${token}` } });

beforeEach(() => {
  config.clear();
  resetYouTubeGuard();
  resetDailymotionGuard();
  setTitleLanguage("fr-FR");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("/api/admin/trailers", () => {
  it("AlloCiné coché par défaut, disponible pour un serveur français ; sources normales", async () => {
    const res = await read();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      allocine: true, allocineAvailable: true, language: "fr",
      sources: { youtube: { state: "normal" }, dailymotion: { state: "normal" } },
    });
  });

  it("un serveur anglais : AlloCiné indisponible (la case grisée)", async () => {
    setTitleLanguage("en-US");
    expect((await read()).json()).toMatchObject({ allocineAvailable: false, language: "en" });
  });

  it("décocher écrit « false », recocher efface la clé", async () => {
    const app = await server();
    const put = (allocine: unknown) =>
      app.inject({ method: "PUT", url: "/api/admin/trailers", headers: { authorization: "Bearer admin" }, payload: { allocine } });
    expect((await put(false)).statusCode).toBe(200);
    expect(config.get("trailers_allocine_enabled")).toBe("false");
    expect((await read()).json().allocine).toBe(false);
    await put(true);
    expect(config.has("trailers_allocine_enabled")).toBe(false);
    expect((await put("oui")).statusCode).toBe(400);
  });

  it("YouTube en pause : jusqu'à quand, et pourquoi", async () => {
    tripYouTubeBreaker("bot");
    const { youtube } = (await read()).json().sources;
    expect(youtube).toMatchObject({ state: "paused", reason: "bot" });
    expect(youtube.until).toBeGreaterThan(Date.now());
  });

  it("refusée à un non-admin", async () => {
    expect((await read("alice")).statusCode).toBe(403);
  });
});
