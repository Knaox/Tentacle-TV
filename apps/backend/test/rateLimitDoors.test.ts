/**
 * Les portes qu'on force par essais répétés ont leur plafond PAR ROUTE, plus
 * strict que le plafond global : connexion (5/min), inscription par invitation
 * (3/min), réclamation d'un code de jumelage (10/h). Le serveur est monté
 * comme `index.ts` le monte — même plugin, même clé (l'adresse RÉELLE), même
 * confiance aux seuls mandataires voisins : un client d'Internet ne remet pas
 * son compteur à zéro en s'inventant une adresse.
 */

import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type InjectOptions } from "fastify";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/configStore", async (original) => ({
  ...(await original<object>()),
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "cle-admin",
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    inviteKey: { findUnique: async () => null },
    pairingCode: { findUnique: async () => null },
    pairedDevice: { count: async () => 0 },
  }),
}));
vi.mock("../src/services/jellyfinIdentity", async (original) => ({
  ...(await original<object>()),
  deviceIdForOpaque: async () => "appareil-banc",
}));
vi.mock("../src/services/accountAccess/loginLockout", () => ({
  beforePasswordLogin: async () => undefined,
  afterPasswordLogin: async () => null,
}));

import { authRoutes } from "../src/routes/auth";
import { pairRoutes } from "../src/routes/pair";
import { rateLimitKey, rateLimitMax } from "../src/services/rateLimitPolicy";
import { isTrustedProxy } from "../src/services/trustedProxies";

let app: FastifyInstance;
let client = 0;

/** Une adresse publique neuve par test : les compteurs ne se mélangent pas. */
function freshClient(): string {
  client += 1;
  return `203.0.113.${client}`;
}

async function build(): Promise<FastifyInstance> {
  const server = Fastify({ trustProxy: (address: string) => isTrustedProxy(address) });
  await server.register(cookie);
  await server.register(rateLimit, { max: (r) => rateLimitMax(r), keyGenerator: (r) => rateLimitKey(r), timeWindow: "1 minute" });
  await server.register(authRoutes, { prefix: "/api/auth" });
  await server.register(pairRoutes, { prefix: "/api/pair" });
  await server.ready();
  return server;
}

beforeEach(async () => {
  // Jellyfin refuse tout mot de passe : chaque essai est un échec de connexion.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  app ??= await build();
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllGlobals();
});

async function hammer(count: number, request: InjectOptions): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) statuses.push((await app.inject(request)).statusCode);
  return statuses;
}

describe("plafonds des portes à essais répétés", () => {
  it("connexion : cinq essais par minute, le sixième est refusé (429)", async () => {
    const remoteAddress = freshClient();
    const statuses = await hammer(6, { method: "POST", url: "/api/auth/login", remoteAddress, payload: { username: "alice", password: "faux" } });
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it("connexion : une adresse inventée (X-Forwarded-For, CF-Connecting-IP) ne remet pas le compteur à zéro", async () => {
    const remoteAddress = freshClient();
    const login = (i: number) => ({
      method: "POST" as const,
      url: "/api/auth/login",
      remoteAddress,
      headers: { "x-forwarded-for": `198.51.100.${i}`, "cf-connecting-ip": `198.51.100.${i}`, "x-real-ip": `198.51.100.${i}` },
      payload: { username: "alice", password: "faux" },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await app.inject(login(i))).statusCode);
    expect(statuses[5]).toBe(429);
  });

  it("le compteur de connexion est par client : un autre n'en pâtit pas", async () => {
    const first = freshClient();
    await hammer(6, { method: "POST", url: "/api/auth/login", remoteAddress: first, payload: { username: "a", password: "b" } });
    const other = await app.inject({ method: "POST", url: "/api/auth/login", remoteAddress: freshClient(), payload: { username: "a", password: "b" } });
    expect(other.statusCode).toBe(401);
  });

  it("inscription par invitation : trois essais par minute (clés d'invitation devinées)", async () => {
    const remoteAddress = freshClient();
    const payload = { username: "nouveau", password: "motdepasse", inviteKey: "0000000000000000" };
    const statuses = await hammer(4, { method: "POST", url: "/api/auth/register", remoteAddress, payload });
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it("réclamation d'un code de jumelage : dix essais par heure, sans jeton (codes de 4 caractères devinés)", async () => {
    const remoteAddress = freshClient();
    const statuses = await hammer(11, { method: "POST", url: "/api/pair/claim", remoteAddress, payload: { code: "ABCD" } });
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400));
    expect(statuses[10]).toBe(429);
  });
});
