/**
 * Le cookie de session n'est donné qu'à un NAVIGATEUR. Une app native (React
 * Native : mobile, TV) s'authentifie par son jeton, mais sa pile réseau garde
 * et renvoie tout cookie reçu : celui de la connexion, au nom du compte, la
 * suivait jusque dans la session d'un profil (alpha mobile, 20/10). La page web
 * garde le sien, posé et glissé comme avant ; une app native n'en reçoit plus,
 * et celle qui en renvoie un d'avant le perd à sa connexion ou à son prochain
 * rafraîchissement — au jeton du compte comme à celui d'un profil.
 */

import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "./jellyfinFakeAuth";

vi.mock("../src/services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../src/services/jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt.")
      ? { userId: "u-profil", username: "Knaoxtest2", isAdmin: false, deviceId: "d", type: "paired_device", scope: "profile", pairingId: "hote" }
      : null,
}));
vi.mock("../src/services/db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({ pairedDevice: { findUnique: async () => ({ id: "pd" }), updateMany: async () => ({ count: 1 }) } }),
}));
vi.mock("../src/services/jellyfinIdentity", async (original) => ({
  ...(await original<object>()),
  deviceIdForOpaque: async () => "appareil-banc",
}));
vi.mock("../src/services/accountAccess/loginLockout", () => ({
  beforePasswordLogin: async () => undefined,
  afterPasswordLogin: async () => null,
}));
vi.mock("../src/services/jellyfinCorsSync", async (original) => ({
  ...(await original<object>()),
  syncJellyfinCors: async () => ({ status: "ready" }),
}));

import { authRoutes } from "../src/routes/auth";

const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
const ANDROID = "okhttp/4.12.0";
const OLD_COOKIE = "jf-cookie-d-avant";

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/Users/AuthenticateByName")) {
      return Response.json({ AccessToken: "jf-neuf", User: { Id: "u-compte", Name: "Knaoxtest", Policy: {} }, ServerId: "s" });
    }
    if (url.endsWith("/Users/Me") && modernJellyfinToken(init?.headers, url).startsWith("jf-")) {
      return Response.json({ Id: "u-compte", Name: "Knaoxtest", Policy: {} });
    }
    return new Response("{}", { status: 401 });
  }));
  app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

function post(path: string, agent: string, payload: object, cookieToken?: string) {
  return app.inject({
    method: "POST",
    url: `/api/auth/${path}`,
    headers: { "user-agent": agent },
    payload,
    ...(cookieToken && { cookies: { tentacle_token: cookieToken } }),
  });
}

/** Ce que la réponse fait du cookie de session : posé (sa valeur), retiré, ou rien. */
function sessionCookie(res: { cookies: Array<{ name: string; value: string; expires?: Date; maxAge?: number }> }): string | "retiré" | null {
  const found = res.cookies.find((c) => c.name === "tentacle_token");
  if (!found) return null;
  const expired = found.value === "" || found.maxAge === 0 || (found.expires !== undefined && found.expires.getTime() <= Date.now());
  return expired ? "retiré" : found.value;
}

const LOGIN = { username: "Knaoxtest", password: "x", client: "Tentacle Mobile", device: "iPhone" };

describe("la connexion", () => {
  it("un navigateur reçoit son cookie, comme avant", async () => {
    expect(sessionCookie(await post("login", BROWSER, LOGIN))).toBe("jf-neuf");
  });

  it("une app native n'en reçoit pas ; celle qui renvoie un cookie d'avant le perd", async () => {
    const fresh = await post("login", ANDROID, LOGIN);
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json().AccessToken).toBe("jf-neuf");
    expect(sessionCookie(fresh)).toBeNull();
    expect(sessionCookie(await post("login", "", LOGIN, OLD_COOKIE))).toBe("retiré"); // iOS : pas de User-Agent
  });
});

describe("le rafraîchissement", () => {
  it("un navigateur : la fenêtre du cookie glisse", async () => {
    expect(sessionCookie(await post("refresh", BROWSER, { token: "jf-compte" }))).toBe("jf-compte");
  });

  it("une app native au jeton du compte : son cookie d'avant est retiré", async () => {
    const res = await post("refresh", ANDROID, { token: "jf-compte" }, OLD_COOKIE);
    expect(res.json().AccessToken).toBe("jf-compte");
    expect(sessionCookie(res)).toBe("retiré");
  });

  it("une app native en session de profil : le cookie du compte qu'elle renvoyait est retiré", async () => {
    const res = await post("refresh", ANDROID, { token: "jwt.profil.sig" }, OLD_COOKIE);
    expect(res.json().AccessToken).toBe("jwt.profil.sig");
    expect(sessionCookie(res)).toBe("retiré");
    expect(sessionCookie(await post("refresh", ANDROID, { token: "jwt.profil.sig" }))).toBeNull();
  });
});
