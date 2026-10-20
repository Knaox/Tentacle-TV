import cors from "@fastify/cors";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("./configStore", () => ({ getPublicUrl: () => null, getConfigValue: () => undefined }));

import { isAllowedOrigin, parseCorsOrigins, tentacleCorsDelegator, type CorsContext } from "./tentacleCors";

const ctx = (over: Partial<CorsContext> = {}): CorsContext => ({
  listed: ["https://ancien.example.com"],
  self: "https://tv.example.com",
  publicUrl: "https://tv.example.com",
  localUrl: "http://192.168.1.20:3000",
  ...over,
});

describe("le CORS de Tentacle", () => {
  it("sans CORS_ORIGINS, tout le monde (comme toujours)", () => {
    expect(isAllowedOrigin("https://n-importe.example", ctx({ listed: [] }))).toBe(true);
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins(" https://a.example , ,https://b.example")).toEqual(["https://a.example", "https://b.example"]);
  });

  it("avec CORS_ORIGINS : la liste, les applications de bureau, et les adresses réglées sans les y recopier", () => {
    for (const origin of ["https://ancien.example.com", "tentacle://app", "tauri://localhost", "https://tv.example.com", "http://192.168.1.20:3000", undefined]) {
      expect(isAllowedOrigin(origin, ctx())).toBe(true);
    }
  });

  it("la page servie par Tentacle lui-même passe toujours, par quelque adresse qu'on l'ouvre", () => {
    expect(isAllowedOrigin("http://nas.local:3000", ctx({ self: "http://nas.local:3000", publicUrl: null, localUrl: null }))).toBe(true);
  });

  it("une origine étrangère est refusée", () => {
    expect(isAllowedOrigin("https://evil.example", ctx())).toBe(false);
    expect(isAllowedOrigin("null", ctx())).toBe(false);
  });

  it("le bureau lit `Retry-After` (429, 503 de migration) — CORS ouvert ou restreint ; une origine refusée, rien", async () => {
    for (const listed of [[], ["https://ancien.example.com"]]) {
      const app = Fastify();
      await app.register(cors, { delegator: tentacleCorsDelegator(listed) });
      app.get("/x", async (_request, reply) => reply.status(429).header("Retry-After", "5").send({ error: "rate_limited" }));
      const res = await app.inject({ url: "/x", headers: { origin: "tentacle://app" } });
      expect([res.headers["access-control-allow-origin"], res.headers["access-control-expose-headers"]]).toEqual(["tentacle://app", "Retry-After, X-Notifications-Next"]);
    }
    const app = Fastify();
    await app.register(cors, { delegator: tentacleCorsDelegator(["https://ancien.example.com"]) });
    app.get("/x", async () => ({ ok: true }));
    const refused = await app.inject({ url: "/x", headers: { origin: "https://evil.example" } });
    expect(refused.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
