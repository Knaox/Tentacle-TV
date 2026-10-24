import { afterEach, describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import Fastify from "fastify";
import { hashToken } from "../../../services/jwt";
import { configureClientFetch, relayClientHandle, resetClientFetchForTests } from "./clientFetchRuntime";
import { registerClientFetchRoute } from "./clientFetchRoute";
import type { PluginRuntimeManifest } from "../pluginServerRuntime";

const manifest: PluginRuntimeManifest = {
  kind: "isolated",
  entry: "server/index.mjs",
  hostApi: ["client"],
  clientFetch: { hosts: ["music.example.com"], mediaHosts: [] },
};
const asRequest = (headers: Record<string, string>) => ({ headers, cookies: {} }) as unknown as FastifyRequest;
const TOKEN = "jeton-du-bureau";

afterEach(() => resetClientFetchForTests());

describe("requêtes déléguées — la poignée posée par le relais", () => {
  it("seulement pour un appareil qui s'annonce, en ligne, et une extension qui déclare la famille et ses hôtes", () => {
    const online = new Set([hashToken(TOKEN)]);
    configureClientFetch({ send: () => true, online: (k) => online.has(k) });
    const announced = { authorization: `Bearer ${TOKEN}`, "x-tentacle-client-fetch": "1" };
    expect(relayClientHandle("sillon", manifest, asRequest(announced))).toMatch(/^[A-Za-z0-9_-]{32}$/);
    // Le web ne s'annonce pas.
    expect(relayClientHandle("sillon", manifest, asRequest({ authorization: `Bearer ${TOKEN}` }))).toBeNull();
    // Extension sans la famille, ou sans hôtes déclarés.
    expect(relayClientHandle("sillon", { ...manifest, hostApi: ["tools"] }, asRequest(announced))).toBeNull();
    expect(relayClientHandle("sillon", { ...manifest, clientFetch: undefined }, asRequest(announced))).toBeNull();
    // Appareil sans socket ouverte.
    expect(relayClientHandle("sillon", manifest, asRequest({ ...announced, authorization: "Bearer autre-jeton" }))).toBeNull();
  });

  it("sans courtier branché : aucune poignée", () => {
    expect(relayClientHandle("sillon", manifest, asRequest({ authorization: `Bearer ${TOKEN}`, "x-tentacle-client-fetch": "1" }))).toBeNull();
  });
});

describe("requêtes déléguées — la route de réponse", () => {
  it("refuse un corps mal formé et une requête inconnue, sans courtier comme avec", async () => {
    const app = Fastify();
    configureClientFetch({ send: () => true, online: () => true });
    const { clientFetchBroker } = await import("./clientFetchRuntime");
    await registerClientFetchRoute(app, clientFetchBroker);
    // La porte d'authentification réelle (`requireAuth`) répond 401 sans jeton : rien n'atteint le courtier.
    const anonymous = await app.inject({ method: "POST", url: "/api/client-fetch/00000000-0000-0000-0000-000000000000", payload: { ok: false, reason: "network" } });
    expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});
