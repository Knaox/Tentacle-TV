/**
 * L'inscription par invitation (`POST /api/auth/register`) : chaque refus porte
 * son `code` — la page d'invitation du serveur le dit dans la langue du
 * navigateur — et garde son `message`, que les clients livrés affichent. Jellyfin
 * est bouchonné sur ce qu'il répond VRAIMENT (mesuré sur 10.11.11) : un nom pris
 * comme un nom refusé valent 400 « Error processing request. ».
 */

import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface InviteRow { id: string; key: string; maxUses: number; currentUses: number; expiresAt: Date | null }
interface UsageRow { inviteKeyId: string; jellyfinUserId: string; username: string }

const invites = new Map<string, InviteRow>();
const usages: UsageRow[] = [];
let jellyfinConfigured = true;

vi.mock("../services/configStore", () => ({
  getJellyfinUrl: () => (jellyfinConfigured ? "http://jf.test" : null),
  getJellyfinApiKey: () => (jellyfinConfigured ? "cle-api" : null),
}));
vi.mock("../services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    inviteKey: {
      findUnique: async (args: { where: { key: string } }) => [...invites.values()].find((row) => row.key === args.where.key) ?? null,
      update: (args: { where: { id: string } }) => ({ op: "use", id: args.where.id }),
    },
    inviteUsage: { create: (args: { data: UsageRow }) => ({ op: "usage", data: args.data }) },
    $transaction: async (ops: Array<{ op: string; id?: string; data?: UsageRow }>) => {
      for (const op of ops) {
        if (op.op === "use") invites.get(op.id!)!.currentUses += 1;
        else usages.push(op.data!);
      }
      return ops;
    },
  }),
}));

import { authAccountRoutes } from "./authAccount";

/** Le Jellyfin bouchonné : ses comptes, et ce qu'il refuse comme 10.11.11. */
let jellyfinUsers: string[] = [];
let usersListBroken = false;
let passwordStep: "ok" | "refused" | "unreachable" = "ok";
let deleteRefused = false;
const calls: Array<{ path: string; body: unknown; method?: string }> = [];

function jellyfin(url: string, init?: RequestInit): Response {
  const path = new URL(url).pathname + new URL(url).search;
  calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined, ...(init?.method === "DELETE" ? { method: "DELETE" } : {}) });
  if (init?.method === "DELETE") {
    if (deleteRefused) return new Response("", { status: 500 });
    jellyfinUsers = jellyfinUsers.filter((_, index) => `/Users/a${index + 1}` !== path);
    return new Response(null, { status: 204 });
  }
  if (path.startsWith("/Users/Password")) {
    if (passwordStep === "unreachable") throw new TypeError("fetch failed");
    return new Response(null, { status: passwordStep === "ok" ? 204 : 500 });
  }
  if (path === "/Users/New") {
    const name = (JSON.parse(String(init?.body)) as { Name: string }).Name;
    const refused = /[^\p{L}\p{N} .\-_'@+]/u.test(name) || name !== name.trim();
    if (refused || jellyfinUsers.some((user) => user.toUpperCase() === name.toUpperCase())) {
      return new Response("Error processing request.", { status: 400 });
    }
    jellyfinUsers.push(name);
    // Un identifiant à la Jellyfin (hexadécimal) : il passe tel quel dans une URL.
    return Response.json({ Id: `a${jellyfinUsers.length}`, Name: name });
  }
  if (path === "/Users") {
    return usersListBroken ? new Response("", { status: 500 }) : Response.json(jellyfinUsers.map((Name) => ({ Name })));
  }
  return new Response("", { status: 404 });
}

/** Ce que la route écrit au journal (avertissements et au-delà). */
const logged: string[] = [];

async function server() {
  const app = Fastify({ logger: { level: "warn", stream: { write: (line: string) => void logged.push(line) } } });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ message: "Validation error" });
    return reply.status(500).send({ message: "Internal server error" });
  });
  await app.register(authAccountRoutes, { prefix: "/api/auth" });
  await app.ready();
  return app;
}

const register = async (body: Record<string, string>) => {
  const app = await server();
  const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: body });
  return { status: res.statusCode, body: res.json() as { message: string; code?: string; userId?: string } };
};

beforeEach(() => {
  invites.clear();
  usages.length = 0;
  calls.length = 0;
  logged.length = 0;
  jellyfinConfigured = true;
  usersListBroken = false;
  passwordStep = "ok";
  deleteRefused = false;
  jellyfinUsers = ["Admin"];
  invites.set("i1", { id: "i1", key: "abc123", maxUses: 2, currentUses: 0, expiresAt: null });
  invites.set("i2", { id: "i2", key: "used00", maxUses: 1, currentUses: 1, expiresAt: null });
  invites.set("i3", { id: "i3", key: "old000", maxUses: 1, currentUses: 0, expiresAt: new Date(Date.now() - 60_000) });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => jellyfin(url, init)));
});
afterEach(() => vi.unstubAllGlobals());

describe("les refus de l'invitation", () => {
  it("clé inconnue, épuisée, expirée : un code chacun, le message d'avant gardé", async () => {
    expect(await register({ inviteKey: "nope00", username: "alice", password: "secret1" })).toEqual({
      status: 400, body: { message: "Clé d'invitation invalide", code: "invite_invalid" },
    });
    expect((await register({ inviteKey: "used00", username: "alice", password: "secret1" })).body.code).toBe("invite_exhausted");
    expect((await register({ inviteKey: "old000", username: "alice", password: "secret1" })).body.code).toBe("invite_expired");
    expect(calls).toEqual([]);
  });

  it("Jellyfin pas relié : 503 jellyfin_unconfigured", async () => {
    jellyfinConfigured = false;
    expect(await register({ inviteKey: "abc123", username: "alice", password: "secret1" })).toEqual({
      status: 503, body: { message: "Jellyfin non configuré", code: "jellyfin_unconfigured" },
    });
  });
});

describe("le nom choisi", () => {
  it("déjà pris, casse ignorée : 409 username_taken, et l'invitation n'est pas consommée", async () => {
    const res = await register({ inviteKey: "ABC123", username: "ADMIN", password: "secret1" });
    expect(res).toEqual({ status: 409, body: { message: "Ce nom d'utilisateur est déjà pris", code: "username_taken" } });
    expect([invites.get("i1")!.currentUses, usages]).toEqual([0, []]);
  });

  it("refusé par Jellyfin (signe interdit) : 400 username_invalid, la règle dite en clair", async () => {
    const res = await register({ inviteKey: "abc123", username: "alice#1", password: "secret1" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("username_invalid");
    expect(res.body.message).toContain("lettres, chiffres, espaces");
    expect(invites.get("i1")!.currentUses).toBe(0);
  });

  it("un 400 que la liste des comptes ne départage pas : la panne, jamais un refus inventé", async () => {
    usersListBroken = true;
    const res = await register({ inviteKey: "abc123", username: "Admin", password: "secret1" });
    expect([res.status, res.body.code]).toEqual([500, "account_creation_failed"]);
  });

  it("les espaces de bord retirés avant Jellyfin : le compte est créé, l'invitation consommée", async () => {
    const res = await register({ inviteKey: "abc123", username: "  élodie o'brien ", password: "secret1" });
    expect(res).toEqual({ status: 201, body: { message: "Compte créé avec succès", userId: "a2" } });
    expect(calls).toEqual([
      { path: "/Users/New", body: { Name: "élodie o'brien" } },
      { path: "/Users/Password?userId=a2", body: { NewPw: "secret1", ResetPassword: false } },
    ]);
    expect([invites.get("i1")!.currentUses, usages]).toEqual([1, [{ inviteKeyId: "i1", jellyfinUserId: "a2", username: "élodie o'brien" }]]);
  });
});

describe("le mot de passe du compte", () => {
  it.each(["refused", "unreachable"] as const)("Jellyfin ne le prend pas (%s) : le compte, sans mot de passe, est retiré", async (step) => {
    passwordStep = step;
    const res = await register({ inviteKey: "abc123", username: "bob", password: "secret1" });
    expect([res.status, res.body.code]).toEqual([500, "account_creation_failed"]);
    expect(calls.filter((call) => call.method === "DELETE").map((call) => call.path)).toEqual(["/Users/a2"]);
    expect([jellyfinUsers, invites.get("i1")!.currentUses, usages]).toEqual([["Admin"], 0, []]);
    expect(logged).toEqual([]);
  });

  it("et s'il ne se laisse pas retirer, le journal le dit avec son identifiant", async () => {
    passwordStep = "refused";
    deleteRefused = true;
    const res = await register({ inviteKey: "abc123", username: "bob", password: "secret1" });
    expect([res.status, res.body.code]).toEqual([500, "account_creation_failed"]);
    expect(logged.join("")).toContain('"jellyfinUserId":"a2"');
    expect(invites.get("i1")!.currentUses).toBe(0);
  });
});
